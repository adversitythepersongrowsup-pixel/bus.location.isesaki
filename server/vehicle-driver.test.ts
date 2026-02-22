import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as TrpcContext["res"],
  };
}

describe("vehicle router", () => {
  it("list returns an array (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.vehicle.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("active returns an array (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.vehicle.active();
    expect(Array.isArray(result)).toBe(true);
  });

  it("create requires admin role", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.vehicle.create({ vehicleNumber: "TEST-001" })
    ).rejects.toThrow();
  });

  it("create succeeds with admin role", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.vehicle.create({
      vehicleNumber: `V-${Date.now()}`,
      vehicleName: "Test Vehicle",
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("delete requires admin role", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.vehicle.delete({ id: 99999 })
    ).rejects.toThrow();
  });
});

describe("driver router", () => {
  it("list returns an array (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.driver.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("active returns an array (public)", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const result = await caller.driver.active();
    expect(Array.isArray(result)).toBe(true);
  });

  it("create requires admin role", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.driver.create({ driverName: "Test Driver" })
    ).rejects.toThrow();
  });

  it("create succeeds with admin role", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const result = await caller.driver.create({
      driverName: `Driver-${Date.now()}`,
      driverCode: `D-${Date.now()}`,
    });
    expect(result.success).toBe(true);
    expect(result.id).toBeDefined();
  });

  it("delete requires admin role", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(
      caller.driver.delete({ id: 99999 })
    ).rejects.toThrow();
  });
});
