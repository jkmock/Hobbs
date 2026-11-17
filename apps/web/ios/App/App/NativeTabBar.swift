import UIKit
import Capacitor

// The tab bar, drawn natively so it's real Liquid Glass (iOS 26+). The web app keeps deciding
// everything: it tells this plugin which tab is selected, whether the bar shows, and the
// colors (setState), and hears back when a tab is tapped ("tabSelected"). On older iOS
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
        let accent = UIColor(cssRGB: call.getString("accent")) ?? .systemBlue
        let ink = UIColor(cssRGB: call.getString("ink")) ?? .secondaryLabel
        DispatchQueue.main.async {
            guard let bar = self.installedBar() else { return call.resolve() }
            bar.overrideUserInterfaceStyle = dark ? .dark : .light
            bar.accent = accent
            bar.ink = ink
            bar.select(selected)
            bar.setVisible(visible)
            call.resolve()
        }
    }

    @available(iOS 26.0, *)
    private func installedBar() -> GlassTabBar? {
        if let bar = bar as? GlassTabBar { return bar }
        guard let host = bridge?.viewController?.view else { return nil }
        let bar = GlassTabBar(tabs: Self.tabs) { [weak self] index in
            self?.notifyListeners("tabSelected", data: ["index": index])
        }
        bar.translatesAutoresizingMaskIntoConstraints = false
        host.addSubview(bar)
        // Where iOS 26 puts its own floating tab bar (measured from a UITabBarController): 21pt
        // in from the sides and up from the bottom of the screen, 62pt tall. The page leaves room
        // for it to match (.native-tabbar in index.css).
        NSLayoutConstraint.activate([
            bar.leadingAnchor.constraint(equalTo: host.leadingAnchor, constant: 21),
            bar.trailingAnchor.constraint(equalTo: host.trailingAnchor, constant: -21),
            bar.heightAnchor.constraint(equalToConstant: 62),
            bar.bottomAnchor.constraint(equalTo: host.bottomAnchor, constant: -21),
        ])
        self.bar = bar
        return bar
    }
}

// A floating capsule of Liquid Glass with one icon button per tab, and a pill in the accent
// color that slides to the selected tab (white icon on it), like the web bar.
@available(iOS 26.0, *)
final class GlassTabBar: UIView {
    var accent: UIColor = .systemBlue { didSet { indicator.backgroundColor = accent } }
    var ink: UIColor = .secondaryLabel { didSet { updateButtonColors() } }

    private let glass = UIVisualEffectView()
    private let indicator = UIView()
    private var buttons: [UIButton] = []
    private var selected = -1
    private var visible = false // shown by the web app's first setState
    private let onSelect: (Int) -> Void
    private let haptics = UISelectionFeedbackGenerator()

    init(tabs: [(image: String, label: String)], onSelect: @escaping (Int) -> Void) {
        self.onSelect = onSelect
        super.init(frame: .zero)

        let effect = UIGlassEffect()
        effect.isInteractive = true // the glass reacts to touches, like system bars
        glass.effect = effect
        glass.cornerConfiguration = .capsule()
        glass.frame = bounds
        glass.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(glass)

        alpha = 0
        isUserInteractionEnabled = false

        indicator.cornerConfiguration = .capsule()
        indicator.alpha = 0
        glass.contentView.addSubview(indicator)

        for (index, tab) in tabs.enumerated() {
            let button = UIButton(type: .custom)
            // 30pt, as drawn on the web bar; template, so tintColor colors it.
            button.setImage(UIImage(named: tab.image)?.withRenderingMode(.alwaysTemplate), for: .normal)
            button.accessibilityLabel = tab.label
            button.addAction(UIAction { [weak self] _ in self?.tapped(index) }, for: .touchUpInside)
            glass.contentView.addSubview(button)
            buttons.append(button)
        }
        updateButtonColors()
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }

    // Laid out like the system tab bar's: 54pt-tall tabs up to 77pt wide, 4pt in from the
    // edges, spread evenly (on a phone they overlap a little, as the system's do).
    private func frameForButton(_ index: Int) -> CGRect {
        let inset: CGFloat = 4
        let height: CGFloat = 54
        let count = CGFloat(buttons.count)
        let inner = bounds.width - inset * 2
        let width = min(77, inner / count)
        let step = count > 1 ? (inner - width) / (count - 1) : 0
        return CGRect(x: inset + CGFloat(index) * step, y: (bounds.height - height) / 2, width: width, height: height)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        for (index, button) in buttons.enumerated() { button.frame = frameForButton(index) }
        if selected >= 0 { indicator.frame = frameForButton(selected) }
    }

    func select(_ index: Int) {
        guard index != selected else { return }
        let wasSelected = selected >= 0
        selected = index
        updateButtonColors()
        guard index >= 0 else {
            UIView.animate(withDuration: 0.2) { self.indicator.alpha = 0 }
            return
        }
        let target = frameForButton(index)
        if wasSelected && window != nil {
            UIView.animate(withDuration: 0.45, delay: 0, usingSpringWithDamping: 0.78, initialSpringVelocity: 0) {
                self.indicator.frame = target
                self.indicator.alpha = 1
            }
        } else {
            indicator.frame = target // first placement: no slide in from nowhere
            UIView.animate(withDuration: 0.2) { self.indicator.alpha = 1 }
        }
    }

    // Slides off the bottom when hidden (a flight's page), like the web bar.
    func setVisible(_ show: Bool) {
        guard show != visible else { return }
        visible = show
        isUserInteractionEnabled = show
        superview?.layoutIfNeeded() // a new bar: placed before it slides in
        let offset = bounds.height + 21
        if show && alpha == 0 { transform = CGAffineTransform(translationX: 0, y: offset) } // slides up from below
        UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseOut, .beginFromCurrentState]) {
            self.transform = show ? .identity : CGAffineTransform(translationX: 0, y: offset)
            self.alpha = show ? 1 : 0
        }
    }

    private func tapped(_ index: Int) {
        haptics.selectionChanged()
        select(index) // at once; the web app confirms it with setState
        onSelect(index)
    }

    private func updateButtonColors() {
        for (index, button) in buttons.enumerated() {
            button.tintColor = index == selected ? .white : ink
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
