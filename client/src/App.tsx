import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Setup from "./pages/Setup";
import TabletDriver from "./pages/TabletDriver";
import Busloc from "./pages/Busloc";
import DashboardLayout from "./components/DashboardLayout";
import AdminDashboard from "./pages/admin/Dashboard";
import GtfsImport from "./pages/admin/GtfsImport";
import DiaManagement from "./pages/admin/DiaManagement";
import AdminMessages from "./pages/admin/Messages";
import AdminCalls from "./pages/admin/Calls";
import AdminDevices from "./pages/admin/Devices";
import AdminBusloc from "./pages/admin/AdminBusloc";
import AdminSetup from "./pages/admin/AdminSetup";
import VehicleManagement from "./pages/admin/VehicleManagement";
import DriverManagement from "./pages/admin/DriverManagement";
import Notices from "./pages/admin/Notices";
import SystemSettings from "./pages/admin/SystemSettings";

function AdminPages() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={AdminDashboard} />
        <Route path="/gtfs" component={GtfsImport} />
        <Route path="/dia" component={DiaManagement} />
        <Route path="/messages" component={AdminMessages} />
        <Route path="/calls" component={AdminCalls} />
        <Route path="/vehicles" component={VehicleManagement} />
        <Route path="/drivers" component={DriverManagement} />
        <Route path="/devices" component={AdminDevices} />
        <Route path="/busloc" component={AdminBusloc} />
        <Route path="/setup" component={AdminSetup} />
        <Route path="/notices" component={Notices} />
        <Route path="/system-settings" component={SystemSettings} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/setup" component={Setup} />
      <Route path="/tablet" component={TabletDriver} />
      <Route path="/busloc" component={Busloc} />
      <Route path="/admin" nest>
        {() => <AdminPages />}
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AppRouter />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
