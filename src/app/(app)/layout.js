import AppNav from "@/components/AppNav";

export default function AppShellLayout({ children }) {
  return (
    <div data-shell="app">
      <AppNav />
      <main
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "24px 16px 48px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
