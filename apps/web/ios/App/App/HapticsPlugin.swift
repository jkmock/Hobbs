import UIKit
import Capacitor

// Taps you feel under your finger (see src/lib/haptics.ts): one as a card presses in or a panel
// opens ("press"), a gentler one as you let go or it settles ("pop"), a firm one as the Props
// button is fully pressed ("medium"), and the propeller's spin ("props").
@objc(HapticsPlugin)
public class HapticsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HapticsPlugin"
    public let jsName = "Haptics"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "impact", returnType: CAPPluginReturnNone),
    ]

    // Made once (at launch: load) and kept ready, so each tap lands the moment it's asked for.
    private lazy var press = UIImpactFeedbackGenerator(style: .light)
    private lazy var pop = UIImpactFeedbackGenerator(style: .soft)
    private lazy var blade = UIImpactFeedbackGenerator(style: .rigid)
    private lazy var medium = UIImpactFeedbackGenerator(style: .medium)

    // Giving props: the propeller's spin, felt. A tap as it's let go, then a crisp tick each time
    // one of its three blades passes (six over its two turns), as timed by the spin in
    // src/lib/propSpin.ts: further apart while it winds up and slows down, closest at full speed,
    // where they're strongest. (ms after letting go, and how hard.)
    private static let propsTicks: [(ms: Int, intensity: CGFloat)] = [
        (0, 0.6), (348, 0.55), (461, 0.8), (555, 1.0), (660, 0.85), (811, 0.6), (1176, 0.35),
    ]

    // Made and warmed up as the app starts (and again whenever it comes back to the front), so
    // the first tap isn't the one that wakes the haptics hardware.
    override public func load() {
        DispatchQueue.main.async { self.warmUp() }
        NotificationCenter.default.addObserver(
            self, selector: #selector(warmUp), name: UIApplication.didBecomeActiveNotification, object: nil)
    }

    @objc private func warmUp() {
        for generator in [press, pop, blade, medium] { generator.prepare() }
    }

    @objc func impact(_ call: CAPPluginCall) {
        let kind = call.getString("kind") ?? "press"
        if kind == "props" {
            DispatchQueue.main.async { self.blade.prepare() }
            for tick in Self.propsTicks {
                DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(tick.ms)) {
                    self.blade.impactOccurred(intensity: tick.intensity)
                    self.blade.prepare()
                }
            }
            return
        }
        if kind == "medium" { // the Props button, fully pressed
            DispatchQueue.main.async {
                self.medium.impactOccurred()
                self.medium.prepare()
            }
            return
        }
        DispatchQueue.main.async {
            let generator = kind == "pop" ? self.pop : self.press
            // A press is a firm little tick; the pop a gentler one as it springs back.
            generator.impactOccurred(intensity: kind == "pop" ? 0.55 : 0.75)
            generator.prepare()
        }
    }
}
