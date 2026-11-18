import AuthenticationServices
import Capacitor
import CryptoKit
import UIKit

// Signing in from the iOS app (lib/nativeAuth.ts on the web side):
// - signInWithApple: Apple's own sheet. Returns Apple's identity token, which the web app sends
//   to the API (POST /auth/apple) to check and sign in with.
// - signInWithGoogle: Google's pages in Apple's secure sign-in sheet (Google won't sign anyone
//   in inside an app's web view). The API sends the new session back to hobbs://auth/google, and
//   this stores it as the API's session cookie, so the token never passes through the page.
@objc(AuthPlugin)
public class AuthPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate,
    ASAuthorizationControllerPresentationContextProviding, ASWebAuthenticationPresentationContextProviding {
    public let identifier = "AuthPlugin"
    public let jsName = "NativeAuth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signInWithApple", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "signInWithGoogle", returnType: CAPPluginReturnPromise),
    ]

    private var appleCall: CAPPluginCall?
    private var appleNonce: String?
    private var appleController: ASAuthorizationController?
    private var googleSession: ASWebAuthenticationSession?

    // MARK: Sign in with Apple

    @objc func signInWithApple(_ call: CAPPluginCall) {
        // A fresh random value; Apple puts its SHA-256 in the token and the API checks it.
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            return call.reject("Couldn't start Sign in with Apple.")
        }
        let nonce = Data(bytes).base64EncodedString()
        let hashed = SHA256.hash(data: Data(nonce.utf8)).map { String(format: "%02x", $0) }.joined()

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = hashed

        DispatchQueue.main.async {
            self.appleCall = call
            self.appleNonce = nonce
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            self.appleController = controller
            controller.performRequests()
        }
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        defer { finishApple() }
        guard let call = appleCall, let nonce = appleNonce else { return }
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8) else {
            return call.reject("Apple didn't send a sign-in token.")
        }
        // The name only comes the first time someone signs in to this app with Apple.
        var result: [String: Any] = ["identityToken": token, "nonce": nonce]
        if let given = credential.fullName?.givenName { result["firstName"] = given }
        if let family = credential.fullName?.familyName { result["lastName"] = family }
        // A one-time code the API swaps with Apple for a refresh token, kept so deleting the
        // account can revoke Hobbs's access (Apple requires it).
        if let codeData = credential.authorizationCode, let code = String(data: codeData, encoding: .utf8) {
            result["authorizationCode"] = code
        }
        call.resolve(result)
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        defer { finishApple() }
        guard let call = appleCall else { return }
        if (error as? ASAuthorizationError)?.code == .canceled {
            call.reject("Canceled", "CANCELED")
        } else {
            call.reject("Sign in with Apple failed. Please try again.", nil, error)
        }
    }

    private func finishApple() {
        appleCall = nil
        appleNonce = nil
        appleController = nil
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        window()
    }

    // MARK: Google, in the sign-in sheet

    @objc func signInWithGoogle(_ call: CAPPluginCall) {
        guard let start = call.getString("startUrl").flatMap(URL.init(string:)),
              let api = call.getString("apiUrl").flatMap(URL.init(string:)), let apiHost = api.host else {
            return call.reject("Missing startUrl or apiUrl")
        }
        DispatchQueue.main.async {
            let session = ASWebAuthenticationSession(url: start, callbackURLScheme: "hobbs") { [weak self] url, error in
                self?.googleSession = nil
                if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
                    return call.reject("Canceled", "CANCELED")
                }
                guard let url = url, let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else {
                    return call.reject("Google sign-in failed. Please try again.", nil, error)
                }
                let value = { (name: String) in items.first { $0.name == name }?.value }
                if let message = value("error") { return call.reject(message) }
                guard let token = value("token") else { return call.reject("Google sign-in failed. Please try again.") }

                // The same cookie the API sets on password login (auth.ts, cookieOptions), for the
                // API's host, where the app's requests go (CapacitorHttp uses this cookie store).
                var properties: [HTTPCookiePropertyKey: Any] = [
                    .name: "session", .value: token, .domain: apiHost, .path: "/",
                    HTTPCookiePropertyKey("HttpOnly"): "TRUE",
                ]
                if api.scheme == "https" { properties[.secure] = "TRUE" }
                if let expires = value("expires").flatMap({ ISO8601DateFormatter.withFractionalSeconds.date(from: $0) }) {
                    properties[.expires] = expires
                }
                guard let cookie = HTTPCookie(properties: properties) else {
                    return call.reject("Google sign-in failed. Please try again.")
                }
                HTTPCookieStorage.shared.setCookie(cookie)
                call.resolve()
            }
            session.presentationContextProvider = self
            self.googleSession = session
            if !session.start() { call.reject("Couldn't open Google sign-in.") }
        }
    }

    public func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        window()
    }

    private func window() -> UIWindow {
        bridge?.viewController?.view.window ?? UIWindow()
    }
}

private extension ISO8601DateFormatter {
    // "2026-12-17T08:30:00.123Z", as JavaScript's toISOString writes it.
    static let withFractionalSeconds: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
