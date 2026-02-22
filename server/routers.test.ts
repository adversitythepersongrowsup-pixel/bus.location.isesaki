import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

// ==================== Helper ====================

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext; clearedCookies: { name: string; options: Record<string, unknown> }[] } {
  const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user-001",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

function createUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "user-002",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

// ==================== Auth Tests ====================

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeDefined();
    expect(result?.openId).toBe("admin-user-001");
    expect(result?.role).toBe("admin");
  });

  it("returns null when not authenticated", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});

// ==================== GTFS Router Tests ====================

describe("gtfs.getRoutes", () => {
  it("returns an array (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gtfs.getRoutes();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("gtfs.getStops", () => {
  it("returns an array without routeId filter", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gtfs.getStops();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns an array with routeId filter", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gtfs.getStops({ routeId: "test-route" });
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("gtfs.getTrips", () => {
  it("returns an array (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gtfs.getTrips();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("gtfs.importRoutes", () => {
  it("requires admin role", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.gtfs.importRoutes({
        routes: [{ routeId: "R001", routeShortName: "1" }],
      })
    ).rejects.toThrow();
  });

  it("succeeds with admin role", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gtfs.importRoutes({
      routes: [
        { routeId: "R001", routeShortName: "1", routeLongName: "テスト路線" },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });
});

describe("gtfs.importStops", () => {
  it("succeeds with admin role", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gtfs.importStops({
      stops: [
        { stopId: "S001", stopName: "テスト停留所", routeId: "R001", stopSequence: 1 },
        { stopId: "S002", stopName: "テスト停留所2", routeId: "R001", stopSequence: 2 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });
});

describe("gtfs.importTrips", () => {
  it("succeeds with admin role", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.gtfs.importTrips({
      trips: [
        { tripId: "T001", routeId: "R001", serviceId: "weekday", tripHeadsign: "テスト行き" },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });
});

// ==================== Dia Router Tests ====================

describe("dia.list", () => {
  it("returns an array (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dia.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("dia.create", () => {
  it("requires admin role", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.dia.create({
        diaName: "テストダイヤ（平日）",
        diaType: "weekday",
        segments: [],
      })
    ).rejects.toThrow();
  });

  it("creates a dia with admin role", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dia.create({
      diaName: "テストダイヤ（平日）",
      diaType: "weekday",
      routeId: "R001",
      segments: [
        { tripId: "T001", stopId: "S001", stopName: "テスト停留所", arrivalTime: "08:00", departureTime: "08:01", stopSequence: 1 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.diaId).toBeDefined();
  });
});

describe("dia.exportCsv", () => {
  it("returns csv strings for non-existent dia", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.dia.exportCsv({ diaId: 99999 });
    expect(result.diaCsv).toBe("");
    expect(result.segmentsCsv).toBe("");
  });
});

// ==================== Message Router Tests ====================

describe("message.send", () => {
  it("succeeds without authentication (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.message.send({
      senderId: "device-001",
      senderType: "tablet",
      content: "テストメッセージ",
    });
    expect(result.success).toBe(true);
  });

  it("sends a message with authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.message.send({
      senderId: "device-001",
      senderType: "tablet",
      senderName: "テスト端末",
      receiverType: "admin",
      content: "テストメッセージ",
    });
    expect(result.success).toBe(true);
    expect(result.messageId).toBeDefined();
  });
});

describe("message.list", () => {
  it("returns messages without authentication (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.message.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns messages for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.message.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ==================== CallLog Router Tests ====================

describe("callLog.start", () => {
  it("succeeds without authentication (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.callLog.start({
      callerId: "device-001",
      callerType: "tablet",
    });
    expect(result.success).toBe(true);
  });

  it("starts a call with authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.callLog.start({
      callerId: "device-001",
      callerType: "tablet",
      callerName: "テスト端末",
      receiverType: "admin",
    });
    expect(result.success).toBe(true);
    expect(result.callId).toBeDefined();
  });
});

describe("callLog.list", () => {
  it("returns call logs for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.callLog.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ==================== Device Router Tests ====================

describe("device.list", () => {
  it("returns an array (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.device.list();
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("device.upsert", () => {
  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.device.upsert({ deviceId: "test-device" })
    ).rejects.toThrow();
  });

  it("creates/updates a device with authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.device.upsert({
      deviceId: "test-device-001",
      deviceName: "テスト端末",
      deviceType: "tablet",
      routeId: "R001",
      vehicleId: "V001",
      displayMode: "normal",
      autoStart: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("device.updateOnline", () => {
  it("updates online status (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.device.updateOnline({
      deviceId: "test-device-001",
      isOnline: true,
    });
    expect(result.success).toBe(true);
  });
});

// ==================== BusLocation Router Tests ====================

describe("busLocation.getAll", () => {
  it("returns an array (admin only)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.busLocation.getAll();
    expect(Array.isArray(result)).toBe(true);
  });
  it("rejects non-admin users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.busLocation.getAll()).rejects.toThrow();
  });
});

describe("busLocation.update", () => {
  it("updates bus location (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.busLocation.update({
      deviceId: "test-device-001",
      routeId: "R001",
      latitude: "35.6812",
      longitude: "139.7671",
      speed: "30",
      status: "in_service",
      currentStopId: "S001",
      nextStopId: "S002",
      delayMinutes: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe("busLocation.getByRoute", () => {
  it("returns an array for a route (admin only)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.busLocation.getByRoute({ routeId: "R001" });
    expect(Array.isArray(result)).toBe(true);
  });
  it("rejects non-admin users", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(caller.busLocation.getByRoute({ routeId: "R001" })).rejects.toThrow();
  });
});

// ==================== OperationLog Router Tests ====================

describe("operationLog.create", () => {
  it("requires authentication", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.operationLog.create({ eventType: "test_event" })
    ).rejects.toThrow();
  });

  it("creates an operation log with authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.operationLog.create({
      deviceId: "test-device-001",
      eventType: "departure",
      eventData: { note: "テスト" },
    });
    expect(result.success).toBe(true);
  });
});

describe("operationLog.list", () => {
  it("returns operation logs for authenticated user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.operationLog.list();
    expect(Array.isArray(result)).toBe(true);
  });
});
