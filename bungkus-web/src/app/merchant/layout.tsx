import Link from "next/link";

const navItems = [
  { href: "/merchant/dashboard", label: "📊 Dashboard", icon: "📊" },
  { href: "/merchant/inventory", label: "📦 Inventory", icon: "📦" },
  { href: "/merchant/analytics", label: "📈 Analytics", icon: "📈" },
  { href: "/merchant/scanner", label: "📱 QR Scanner", icon: "📱" },
];

export default function MerchantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dark-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-dark-200 hidden lg:block">
        <div className="p-6">
          <Link href="/merchant" className="text-xl font-bold text-eco-500">
            🌱 Bungkus! Merchant
          </Link>
        </div>
        <nav className="px-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-dark-600 hover:bg-eco-50 hover:text-eco-600 transition mb-1"
            >
              <span>{item.icon}</span>
              <span className="font-medium">{item.label.replace(/^[^\s]+ /, "")}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 p-6">{children}</main>
    </div>
  );
}
