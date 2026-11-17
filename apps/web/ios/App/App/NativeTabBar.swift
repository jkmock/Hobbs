import UIKit
import Capacitor

// The tab bar, drawn natively so it's real Liquid Glass (iOS 26+). The web app keeps deciding
// everything: it tells this plugin which tab is selected, whether the bar shows, and the
// colors (setState), and hears back when a tab is chosen ("tabSelected"). On older iOS
// isAvailable says no, and the web app shows its own bar instead (src/components/AppLayout.tsx).
@objc(NativeTabBarPlugin)
public class NativeTabBarPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeTabBarPlugin"
    public let jsName = "NativeTabBar"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setState", returnType: CAPPluginReturnPromise),
    ]

    // The same tabs, in the same order, as TABS in AppLayout.tsx, with the same Lucide icons:
    // template images in Assets.xcassets (Tab*.imageset, made from lucide-react's icon data).
    private static let tabs: [(image: String, label: String)] = [
        ("TabFeed", "Feed"),
        ("TabFlights", "Flights"),
        ("TabMap", "Map"),
        ("TabGoal", "Goal"),
        ("TabProfile", "Profile"),
    ]

    private var bar: UIView?

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 26.0, *) {
            call.resolve(["available": true])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func setState(_ call: CAPPluginCall) {
        guard #available(iOS 26.0, *) else { return call.resolve() }
        let visible = call.getBool("visible") ?? false
        let selected = call.getInt("selected") ?? -1
        let dark = call.getBool("dark") ?? false
        DispatchQueue.main.async {
            guard let bar = self.installedBar() else { return call.resolve() }
            if dark {
                // Dark mode: every icon white (the glass highlight marks the selected one).
                bar.overrideUserInterfaceStyle = .dark
                bar.tintColor = .white
                bar.unselectedItemTintColor = .white
            } else {
                // Light mode: left to the system, so the glass and its icons flip light or dark
                // with what's behind them. The selected icon is .label (near-black, white once
                // flipped dark); the rest take the system's own adaptive color. Forced light
                // only when the system is dark but the app's theme is light (Settings).
                let systemDark = bar.superview?.traitCollection.userInterfaceStyle == .dark
                bar.overrideUserInterfaceStyle = systemDark ? .light : .unspecified
                bar.tintColor = .label
                bar.unselectedItemTintColor = nil
            }
            bar.select(selected)
            bar.setVisible(visible)
            call.resolve()
        }
    }

    @available(iOS 26.0, *)
    private func installedBar() -> SystemTabBar? {
        if let bar = bar as? SystemTabBar { return bar }
        guard let host = bridge?.viewController?.view else { return nil }
        let bar = SystemTabBar(tabs: Self.tabs) { [weak self] index in
            self?.notifyListeners("tabSelected", data: ["index": index])
        }
        bar.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(bar)
        // Across the bottom, as a UITabBarController places it: the bar sizes itself (safe
        // area included) and draws its floating glass capsule inside. The page leaves room for
        // it to match (.native-tabbar in index.css).
        NSLayoutConstraint.activate([
            bar.leadingAnchor.constraint(equalTo: host.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: host.trailingAnchor),
            bar.bottomAnchor.constraint(equalTo: host.bottomAnchor),
        ])
        self.bar = bar
        return bar
    }
}

// The system tab bar itself (iOS 26 Liquid Glass), so it behaves exactly like the App
// Store's: press and drag along it and a glass bubble follows your finger between tabs.
@available(iOS 26.0, *)
final class SystemTabBar: UITabBar, UITabBarDelegate {
    private var visible = false // shown by the web app's first setState
    private let onSelect: (Int) -> Void

    init(tabs: [(image: String, label: String)], onSelect: @escaping (Int) -> Void) {
        self.onSelect = onSelect
        super.init(frame: .zero)
        items = tabs.enumerated().map { index, tab in
            UITabBarItem(title: tab.label, image: Self.icon(tab.image), tag: index)
        }
        delegate = self
        alpha = 0
        isUserInteractionEnabled = false
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // The Lucide icons are 30pt vectors (sized for the web bar); the system bar's are ~26pt.
    private static func icon(_ name: String) -> UIImage? {
        guard let image = UIImage(named: name) else { return nil }
        let size = CGSize(width: 26, height: 26)
        return UIGraphicsImageRenderer(size: size)
            .image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
            .withRenderingMode(.alwaysTemplate)
    }

    func select(_ index: Int) {
        guard let items else { return }
        selectedItem = items.indices.contains(index) ? items[index] : nil
    }

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        onSelect(item.tag) // the web app navigates and confirms it with setState
    }

    // Slides off the bottom when hidden (a flight's page, the full-screen map), like the web bar.
    func setVisible(_ show: Bool) {
        guard show != visible else { return }
        visible = show
        isUserInteractionEnabled = show
        superview?.layoutIfNeeded() // a new bar: placed before it slides in
        let offset = bounds.height
        if show && alpha == 0 { transform = CGAffineTransform(translationX: 0, y: offset) } // slides up from below
        UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
            self.transform = show ? .identity : CGAffineTransform(translationX: 0, y: offset)
            self.alpha = show ? 1 : 0
        }
    }
}

extension UIColor {
    // Reads the "rgb(15, 31, 64)" / "rgba(...)" form getComputedStyle gives.
    convenience init?(cssRGB: String?) {
        guard let css = cssRGB, let open = css.firstIndex(of: "("), let close = css.lastIndex(of: ")") else { return nil }
        let parts = css[css.index(after: open)..<close]
            .split(whereSeparator: { $0 == "," || $0 == " " || $0 == "/" })
            .compactMap { Double($0) }
        guard parts.count >= 3 else { return nil }
        self.init(red: parts[0] / 255, green: parts[1] / 255, blue: parts[2] / 255, alpha: parts.count > 3 ? parts[3] : 1)
    }
}
