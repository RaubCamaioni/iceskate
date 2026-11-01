import SwiftUI
import WebKit

/// The whole app is one WKWebView showing the published schedule site.
struct ContentView: View {
    @StateObject private var model = WebModel()

    var body: some View {
        ZStack {
            Color(red: 0.06, green: 0.09, blue: 0.125).ignoresSafeArea()
            SiteWebView(model: model)
                .ignoresSafeArea(edges: .bottom)
            if model.failed {
                VStack(spacing: 16) {
                    Text("The schedule could not be loaded. Check your connection and try again.")
                        .multilineTextAlignment(.center)
                        .foregroundColor(.white)
                    Button("Try again") { model.reload() }
                        .buttonStyle(.borderedProminent)
                }
                .padding(32)
                .background(Color(red: 0.06, green: 0.09, blue: 0.125))
            }
        }
    }
}

final class WebModel: ObservableObject {
    static let site = URL(string: "https://raubcamaioni.github.io/iceskate/")!
    static let host = "raubcamaioni.github.io"
    @Published var failed = false
    weak var webView: WKWebView?

    func reload() {
        failed = false
        webView?.load(URLRequest(url: Self.site))
    }
}

struct SiteWebView: UIViewRepresentable {
    @ObservedObject var model: WebModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.06, green: 0.09, blue: 0.125, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.pulled(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh
        model.webView = web
        web.load(URLRequest(url: WebModel.site))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        let model: WebModel
        init(model: WebModel) { self.model = model }

        @objc func pulled(_ sender: UIRefreshControl) {
            model.webView?.reload()
        }

        // Links that leave the site (rink websites, directions, phone numbers) open in the phone's own apps.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.allow); return }
            let inSite = url.scheme == "https" && url.host?.lowercased() == WebModel.host
            if inSite || url.scheme == "about" {
                decisionHandler(.allow)
            } else {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.failed = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            model.failed = true
        }
    }
}
