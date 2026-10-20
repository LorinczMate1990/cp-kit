import { create } from 'zustand';

interface Widget {
  id: string;
  name: string;
  type: string;
  config: any;
  position: { x: number; y: number; w: number; h: number };
  data?: any;
}

// A dashboard in the list (GET /dashboards): no widgets, only their count
interface DashboardSummary {
  id: string;
  name: string;
  description?: string;
  layout: string;
  _count?: { widgets: number };
}

// The opened dashboard (GET /dashboards/:id), with its widgets
interface Dashboard extends DashboardSummary {
  widgets: Widget[];
}

interface DashboardState {
  dashboards: DashboardSummary[];
  currentDashboard: Dashboard | null;
  isLoading: boolean;
  error: string | null;

  setDashboards: (dashboards: DashboardSummary[]) => void;
  addDashboard: (dashboard: DashboardSummary) => void;
  removeDashboard: (id: string) => void;
  setCurrentDashboard: (dashboard: Dashboard | null) => void;
  updateDashboard: (id: string, updates: Partial<DashboardSummary>) => void;

  // Widget actions only change the opened dashboard: list items don't hold widgets

  addWidget: (dashboardId: string, widget: Widget) => void;
  updateWidget: (dashboardId: string, widgetId: string, updates: Partial<Widget>) => void;
  removeWidget: (dashboardId: string, widgetId: string) => void;
  setWidgetData: (dashboardId: string, widgetId: string, data: any) => void;
  reorderWidgets: (dashboardId: string, widgets: Widget[]) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  dashboards: [],
  currentDashboard: null,
  isLoading: false,
  error: null,

  setDashboards: (dashboards) => {
    set({ dashboards });
  },

  addDashboard: (dashboard) => {
    set({ dashboards: [...get().dashboards, dashboard] });
  },

  removeDashboard: (id) => {
    set({
      dashboards: get().dashboards.filter((d) => d.id !== id),
    });
  },

  setCurrentDashboard: (dashboard) => {
    set({ currentDashboard: dashboard });
  },

  updateDashboard: (id, updates) => {
    const current = get().currentDashboard;
    set({
      dashboards: get().dashboards.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      // Also update current if it matches
      currentDashboard: current?.id === id ? { ...current, ...updates } : current,
    });
  },

  addWidget: (dashboardId, widget) => {
    const current = get().currentDashboard;
    if (current?.id === dashboardId) {
      set({ currentDashboard: { ...current, widgets: [...current.widgets, widget] } });
    }
  },

  updateWidget: (dashboardId, widgetId, updates) => {
    const current = get().currentDashboard;
    if (current?.id === dashboardId) {
      set({
        currentDashboard: {
          ...current,
          widgets: current.widgets.map((w) => (w.id === widgetId ? { ...w, ...updates } : w)),
        },
      });
    }
  },

  removeWidget: (dashboardId, widgetId) => {
    const current = get().currentDashboard;
    if (current?.id === dashboardId) {
      set({
        currentDashboard: { ...current, widgets: current.widgets.filter((w) => w.id !== widgetId) },
      });
    }
  },

  setWidgetData: (dashboardId, widgetId, data) => {
    const current = get().currentDashboard;
    if (current?.id === dashboardId) {
      set({
        currentDashboard: {
          ...current,
          widgets: current.widgets.map((w) => (w.id === widgetId ? { ...w, data } : w)),
        },
      });
    }
  },

  reorderWidgets: (dashboardId, widgets) => {
    const current = get().currentDashboard;
    if (current?.id === dashboardId) {
      set({ currentDashboard: { ...current, widgets } });
    }
  },
}));
