import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

// The app's one screen: Capacitor's web view, with one change. Since iOS 26 every scroll view
// fades whatever scrolls under the status bar into a color iOS picks itself (grey in light mode,
// the navy launch color in dark mode), which doesn't match the page. The page already colors
// that area itself (src/lib/statusBar.ts, like Safari), so the fade is turned off.
// SceneDelegate.swift uses this class instead of CAPBridgeViewController.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        UIScrollView.hideTopEdgeEffects()
    }
}

extension UIScrollView {
    // The pages scroll inside their own elements (overflow: auto), and WebKit makes each of
    // those a scroll view of its own, created and replaced as pages change. So instead of
    // finding them, every scroll view hides its top fade as it appears on screen.
    private static var hidingTopEdgeEffects = false

    static func hideTopEdgeEffects() {
        // Once only: swapping a second time would swap the methods back.
        guard #available(iOS 26.0, *), !hidingTopEdgeEffects else { return }
        hidingTopEdgeEffects = true
        let cls: AnyClass = UIScrollView.self
        let originalSelector = #selector(didMoveToWindow)
        let replacementSelector = #selector(hobbs_didMoveToWindow)
        guard let original = class_getInstanceMethod(cls, originalSelector),
              let replacement = class_getInstanceMethod(cls, replacementSelector) else { return }
        // didMoveToWindow belongs to UIView, so give UIScrollView its own copy before swapping;
        // swapping UIView's would change every view, not just scroll views.
        if class_addMethod(cls, originalSelector, method_getImplementation(replacement), method_getTypeEncoding(replacement)) {
            class_replaceMethod(cls, replacementSelector, method_getImplementation(original), method_getTypeEncoding(original))
        } else {
            method_exchangeImplementations(original, replacement)
        }
    }

    @objc private func hobbs_didMoveToWindow() {
        hobbs_didMoveToWindow() // the original didMoveToWindow (the two are swapped)
        if #available(iOS 26.0, *), window != nil {
            topEdgeEffect.isHidden = true
        }
    }
}
