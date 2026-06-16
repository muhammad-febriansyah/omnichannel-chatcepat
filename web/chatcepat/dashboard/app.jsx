/* global React, ReactDOM, TopHeader, Sidebar, InboxView, DashboardView */
const { useState: useStateApp } = React;

function App() {
  const [view, setView] = useStateApp("dashboard");
  const [collapsed, setCollapsed] = useStateApp(false);
  const sidebarActive = view === "dashboard" ? "dashboard" : "inbox";

  function handleNav(id) {
    if (id === "dashboard") setView("dashboard");
    else setView("inbox");
  }

  return (
    <div className={"app-shell " + (collapsed ? "sb-collapsed" : "")}>
      <TopHeader
        view={view}
        onView={setView}
        onToggleSidebar={() => setCollapsed(c => !c)}
      />
      <div className="app-body">
        <Sidebar
          collapsed={collapsed}
          active={sidebarActive}
          onNavigate={handleNav}
        />
        <main className="app-main" data-screen-label={view === "dashboard" ? "Dashboard" : "Inbox"}>
          {view === "dashboard" ? <DashboardView/> : <InboxView/>}
        </main>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App/>);
