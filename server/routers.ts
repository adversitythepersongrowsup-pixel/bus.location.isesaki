import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { broadcastSSE } from "./sse";
import { updateArrivalsFromHeartbeat } from "./etaCalculator";

// ==================== Vehicle Router ====================
const vehicleRouter = router({
  create: adminProcedure
    .input(z.object({
      vehicleNumber: z.string().min(1),
      vehicleName: z.string().optional(),
      capacity: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createVehicle({
        vehicleNumber: input.vehicleNumber,
        vehicleName: input.vehicleName ?? null,
        capacity: input.capacity ?? null,
      });
      return { success: true, id };
    }),

  list: publicProcedure.query(async () => {
    return db.getAllVehicles();
  }),

  active: publicProcedure.query(async () => {
    return db.getActiveVehicles();
  }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      vehicleNumber: z.string().optional(),
      vehicleName: z.string().optional(),
      capacity: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateVehicle(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteVehicle(input.id);
      return { success: true };
    }),
  deleteAll: adminProcedure
    .mutation(async () => {
      await db.deleteAllVehicles();
      return { success: true };
    }),
});
// ==================== Driver Router =====================
const driverRouter = router({
  create: adminProcedure
    .input(z.object({
      driverName: z.string().min(1),
      driverCode: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createDriver({
        driverName: input.driverName,
        driverCode: input.driverCode ?? null,
      });
      return { success: true, id };
    }),

  list: publicProcedure.query(async () => {
    return db.getAllDrivers();
  }),

  active: publicProcedure.query(async () => {
    return db.getActiveDrivers();
  }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      driverName: z.string().optional(),
      driverCode: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateDriver(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteDriver(input.id);
      return { success: true };
    }),
  deleteAll: adminProcedure
    .mutation(async () => {
      await db.deleteAllDrivers();
      return { success: true };
    }),
});
// ==================== GTFS Router =====================
const gtfsRouter = router({
  importRoutes: adminProcedure
    .input(z.object({
      routes: z.array(z.object({
        routeId: z.string(),
        routeShortName: z.string().optional(),
        routeLongName: z.string().optional(),
        routeType: z.number().optional(),
        routeColor: z.string().optional(),
      })),
      mode: z.enum(["append", "delete", "overwrite"]).default("append"),
    }))
    .mutation(async ({ input }) => {
      if (input.mode === "delete") {
        await db.clearAllRoutes();
        return { success: true, count: 0 };
      }
      if (input.mode === "overwrite") await db.clearAllRoutes();
      await db.upsertRoutes(input.routes.map(r => ({
        routeId: r.routeId,
        routeShortName: r.routeShortName ?? null,
        routeLongName: r.routeLongName ?? null,
        routeType: r.routeType ?? 3,
        routeColor: r.routeColor ?? null,
      })));
      return { success: true, count: input.routes.length };
    }),

  importStops: adminProcedure
    .input(z.object({
      stops: z.array(z.object({
        stopId: z.string(),
        stopName: z.string(),
        stopLat: z.string().optional(),
        stopLon: z.string().optional(),
        stopSequence: z.number().optional(),
        routeId: z.string().optional(),
      })),
      mode: z.enum(["append", "delete", "overwrite"]).default("append"),
    }))
    .mutation(async ({ input }) => {
      if (input.mode === "delete") {
        await db.clearAllStops();
        return { success: true, count: 0 };
      }
      if (input.mode === "overwrite") await db.clearAllStops();
      await db.upsertStops(input.stops.map(s => ({
        stopId: s.stopId,
        stopName: s.stopName,
        stopLat: s.stopLat ?? null,
        stopLon: s.stopLon ?? null,
        stopSequence: s.stopSequence ?? null,
        routeId: s.routeId ?? null,
      })));
      return { success: true, count: input.stops.length };
    }),

  importTrips: adminProcedure
    .input(z.object({
      trips: z.array(z.object({
        tripId: z.string(),
        routeId: z.string(),
        serviceId: z.string().optional(),
        tripHeadsign: z.string().optional(),
        directionId: z.number().optional(),
      })),
      mode: z.enum(["append", "delete", "overwrite"]).default("append"),
    }))
    .mutation(async ({ input }) => {
      if (input.mode === "delete") {
        await db.clearAllTrips();
        return { success: true, count: 0 };
      }
      if (input.mode === "overwrite") await db.clearAllTrips();
      await db.upsertTrips(input.trips.map(t => ({
        tripId: t.tripId,
        routeId: t.routeId,
        serviceId: t.serviceId ?? null,
        tripHeadsign: t.tripHeadsign ?? null,
        directionId: t.directionId ?? null,
      })));
      return { success: true, count: input.trips.length };
    }),

  importStopTimes: adminProcedure
    .input(z.object({
      stopTimes: z.array(z.object({
        tripId: z.string(),
        stopId: z.string(),
        arrivalTime: z.string().optional(),
        departureTime: z.string().optional(),
        stopSequence: z.number(),
        stopHeadsign: z.string().optional(),
      })),
      mode: z.enum(["append", "delete", "overwrite"]).default("append"),
    }))
    .mutation(async ({ input }) => {
      if (input.mode === "delete") {
        await db.clearAllStopTimes();
        return { success: true, count: 0 };
      }
      if (input.mode === "overwrite") await db.clearAllStopTimes();
      await db.upsertStopTimes(input.stopTimes.map(st => ({
        tripId: st.tripId,
        stopId: st.stopId,
        arrivalTime: st.arrivalTime ?? null,
        departureTime: st.departureTime ?? null,
        stopSequence: st.stopSequence,
        stopHeadsign: st.stopHeadsign ?? null,
      })));
      return { success: true, count: input.stopTimes.length };
    }),

  getRoutes: publicProcedure.query(async () => {
    return db.getAllRoutes();
  }),

  getStops: publicProcedure
    .input(z.object({ routeId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.routeId) return db.getStopsByRoute(input.routeId);
      return db.getAllStops();
    }),

  getTrips: publicProcedure
    .input(z.object({ routeId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.routeId) return db.getTripsByRoute(input.routeId);
      return db.getAllTrips();
    }),

  getStopTimes: publicProcedure
    .input(z.object({ tripId: z.string() }))
    .query(async ({ input }) => {
      return db.getStopTimesByTrip(input.tripId);
    }),
  getAllStopTimes: publicProcedure
    .query(async () => {
      return db.getAllStopTimes();
    }),
  /** 便一覧（始発停留所・始発時間・終着情報付き）ダイヤ仕分け用 */
  getTripsWithFirstStop: publicProcedure
    .input(z.object({ routeId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.getTripsWithFirstStop(input?.routeId);
    }),
  /** ダイヤに紐付済みのtripId一覧（仕分済み判定用） */
  getAssignedTripIds: publicProcedure.query(async () => {
    return db.getAssignedTripIds();
  }),
});

// ==================== Dia Router ====================
const diaRouter = router({
  create: adminProcedure
    .input(z.object({
      diaName: z.string().min(1),
      diaType: z.enum(["weekday", "holiday"]),
      routeId: z.string().optional(),
      description: z.string().optional(),
      segments: z.array(z.object({
        tripId: z.string(),
        stopId: z.string(),
        stopName: z.string().optional(),
        arrivalTime: z.string().optional(),
        departureTime: z.string().optional(),
        stopSequence: z.number(),
      })),
    }))
    .mutation(async ({ input }) => {
      const diaId = await db.createDia({
        diaName: input.diaName,
        diaType: input.diaType,
        routeId: input.routeId ?? null,
        description: input.description ?? null,
      });
      if (diaId && input.segments.length > 0) {
        await db.createDiaSegments(input.segments.map(s => ({
          diaId,
          tripId: s.tripId,
          stopId: s.stopId,
          stopName: s.stopName ?? null,
          arrivalTime: s.arrivalTime ?? null,
          departureTime: s.departureTime ?? null,
          stopSequence: s.stopSequence,
        })));
      }
      return { success: true, diaId };
    }),

  list: publicProcedure.query(async () => {
    return db.getAllDias();
  }),

  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const dia = await db.getDiaById(input.id);
      if (!dia) return null;
      const segments = await db.getDiaSegmentsByDia(input.id);
      return { ...dia, segments };
    }),

  update: adminProcedure
    .input(z.object({
      id: z.number(),
      diaName: z.string().optional(),
      diaType: z.enum(["weekday", "holiday"]).optional(),
      routeId: z.string().optional(),
      description: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateDia(id, data);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteDia(input.id);
      return { success: true };
    }),
  merge: adminProcedure
    .input(z.object({ sourceDiaId: z.number(), targetDiaId: z.number() }))
    .mutation(async ({ input }) => {
      await db.mergeDias(input.sourceDiaId, input.targetDiaId);
      return { success: true };
    }),
  /** ダイヤの並び順を保存 */
  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      await db.reorderDias(input.orderedIds);
      return { success: true };
    }),
  getSegments: publicProcedure
    .input(z.object({ diaId: z.number() }))
    .query(async ({ input }) => {
      return db.getDiaSegmentsByDia(input.diaId);
    }),

  listByRoute: publicProcedure
    .input(z.object({ routeId: z.string() }))
    .query(async ({ input }) => {
      return db.getDiasByRoute(input.routeId);
    }),

  listGrouped: publicProcedure.query(async () => {
    return db.getDiasGroupedByRoute();
  }),

  /** GTFS便をダイヤに紐付け（stop_timesからsegmentsを一括生成） */
  assignTrip: adminProcedure
    .input(z.object({
      diaId: z.number(),
      tripId: z.string(),
    }))
    .mutation(async ({ input }) => {
      // stop_timesから全停留所を取得
      const stopTimeRows = await db.getStopTimesByTrip(input.tripId);
      if (stopTimeRows.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "便の時刻データが見つかりません" });
      }
      // 同一tripIdの既存segmentsを削除して再登録
      await db.removeDiaSegmentsByTrip(input.diaId, input.tripId);
      await db.createDiaSegments(stopTimeRows.map(st => ({
        diaId: input.diaId,
        tripId: st.tripId,
        stopId: st.stopId,
        stopName: null,
        arrivalTime: st.arrivalTime ?? null,
        departureTime: st.departureTime ?? null,
        stopSequence: st.stopSequence,
      })));
      return { success: true, count: stopTimeRows.length };
    }),
  /** 複数便を一括でダイヤに紐付け */
  bulkAssignTrips: adminProcedure
    .input(z.object({
      diaId: z.number(),
      tripIds: z.array(z.string()),
    }))
    .mutation(async ({ input }) => {
      let totalCount = 0;
      for (const tripId of input.tripIds) {
        const stopTimeRows = await db.getStopTimesByTrip(tripId);
        if (stopTimeRows.length === 0) continue;
        await db.removeDiaSegmentsByTrip(input.diaId, tripId);
        await db.createDiaSegments(stopTimeRows.map(st => ({
          diaId: input.diaId,
          tripId: st.tripId,
          stopId: st.stopId,
          stopName: null,
          arrivalTime: st.arrivalTime ?? null,
          departureTime: st.departureTime ?? null,
          stopSequence: st.stopSequence,
        })));
        totalCount += stopTimeRows.length;
      }
      return { success: true, count: totalCount, tripCount: input.tripIds.length };
    }),
  /** ダイヤから便の紐付けを解除 */
  removeTrip: adminProcedure
    .input(z.object({ diaId: z.number(), tripId: z.string() }))
    .mutation(async ({ input }) => {
      await db.removeDiaSegmentsByTrip(input.diaId, input.tripId);
      return { success: true };
    }),
  exportCsv: publicProcedure
    .input(z.object({ diaId: z.number() }))
    .query(async ({ input }) => {
      const dia = await db.getDiaById(input.diaId);
      if (!dia) return { diaCsv: "", segmentsCsv: "" };
      const segments = await db.getDiaSegmentsByDia(input.diaId);

      // dia.csv
      const diaCsv = [
        "id,diaName,diaType,routeId,description,isActive",
        `${dia.id},"${dia.diaName}","${dia.diaType}","${dia.routeId ?? ""}","${dia.description ?? ""}",${dia.isActive}`,
      ].join("\n");

      // dia_segments.csv
      const segHeader = "id,diaId,tripId,stopId,stopName,arrivalTime,departureTime,stopSequence";
      const segRows = segments.map(s =>
        `${s.id},${s.diaId},"${s.tripId}","${s.stopId}","${s.stopName ?? ""}","${s.arrivalTime ?? ""}","${s.departureTime ?? ""}",${s.stopSequence}`
      );
      const segmentsCsv = [segHeader, ...segRows].join("\n");

      return { diaCsv, segmentsCsv };
    }),
});

// ==================== Message Router ====================
const messageRouter = router({
  send: publicProcedure
    .input(z.object({
      senderId: z.string(),
      senderType: z.enum(["admin", "tablet"]),
      senderName: z.string().optional(),
      receiverId: z.string().optional(),
      receiverType: z.enum(["admin", "tablet"]).optional(),
      content: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createMessage({
        senderId: input.senderId,
        senderType: input.senderType,
        senderName: input.senderName ?? null,
        receiverId: input.receiverId ?? null,
        receiverType: input.receiverType ?? null,
        content: input.content,
      });
      // Broadcast new message to all SSE clients in real-time
      broadcastSSE("new_message", {
        id,
        senderId: input.senderId,
        senderType: input.senderType,
        senderName: input.senderName ?? null,
        receiverId: input.receiverId ?? null,
        receiverType: input.receiverType ?? null,
        content: input.content,
        isRead: false,
        createdAt: new Date().toISOString(),
      });
      return { success: true, messageId: id };
    }),

  list: publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.getMessages(input?.limit ?? 100);
    }),

  byDevice: publicProcedure
    .input(z.object({ deviceId: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return db.getMessagesByDevice(input.deviceId, input.limit ?? 50);
    }),

  markRead: publicProcedure
    .input(z.object({ ids: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      await db.markMessagesAsRead(input.ids);
      return { success: true };
    }),
});

// ==================== Call Router ====================
const callRouter = router({
  start: publicProcedure
    .input(z.object({
      callerId: z.string(),
      callerType: z.enum(["admin", "tablet"]),
      callerName: z.string().optional(),
      receiverId: z.string().optional(),
      receiverType: z.enum(["admin", "tablet"]).optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createCallLog({
        callerId: input.callerId,
        callerType: input.callerType,
        callerName: input.callerName ?? null,
        receiverId: input.receiverId ?? null,
        receiverType: input.receiverType ?? null,
        startedAt: new Date(),
      });
      return { success: true, callId: id };
    }),

  updateStatus: publicProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["ringing", "active", "ended", "missed"]),
      duration: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const updateData: any = { status: input.status };
      if (input.status === "ended") {
        updateData.endedAt = new Date();
        if (input.duration !== undefined) updateData.duration = input.duration;
      }
      await db.updateCallLog(input.id, updateData);
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.getCallLogs(input?.limit ?? 50);
    }),
});

// ==================== Device Router ====================
const deviceRouter = router({
  upsert: protectedProcedure
    .input(z.object({
      deviceId: z.string(),
      deviceName: z.string().optional(),
      deviceType: z.enum(["tablet", "busloc", "admin"]).optional(),
      routeId: z.string().optional(),
      vehicleId: z.string().optional(),
      diaId: z.number().optional(),
      displayMode: z.enum(["normal", "simple", "night"]).optional(),
      autoStart: z.boolean().optional(),
      settings: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.upsertDevice({
        deviceId: input.deviceId,
        deviceName: input.deviceName ?? null,
        deviceType: input.deviceType ?? "tablet",
        routeId: input.routeId ?? null,
        vehicleId: input.vehicleId ?? null,
        diaId: input.diaId ?? null,
        displayMode: input.displayMode ?? "normal",
        autoStart: input.autoStart ?? false,
        settings: input.settings ?? null,
      });
      return { success: true };
    }),

  list: publicProcedure.query(async () => {
    return db.getAllDevices();
  }),

  get: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input }) => {
      return db.getDeviceById(input.deviceId);
    }),

  updateOnline: publicProcedure
    .input(z.object({ deviceId: z.string(), isOnline: z.boolean() }))
    .mutation(async ({ input }) => {
      await db.updateDeviceOnline(input.deviceId, input.isOnline);
      return { success: true };
    }),

  delete: adminProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteDevice(input.deviceId);
      return { success: true };
    }),
});

// ==================== BusLocation Router ====================
const busLocationRouter = router({
  update: publicProcedure
    .input(z.object({
      deviceId: z.string(),
      routeId: z.string().optional(),
      tripId: z.string().optional(),
      latitude: z.string(),
      longitude: z.string(),
      speed: z.string().optional(),
      heading: z.string().optional(),
      delayMinutes: z.number().optional(),
      currentStopId: z.string().optional(),
      nextStopId: z.string().optional(),
      status: z.enum(["in_service", "out_of_service", "delayed", "not_started"]).optional(),
    }))
    .mutation(async ({ input }) => {
      await db.upsertBusLocation({
        deviceId: input.deviceId,
        routeId: input.routeId ?? null,
        tripId: input.tripId ?? null,
        latitude: input.latitude,
        longitude: input.longitude,
        speed: input.speed ?? null,
        heading: input.heading ?? null,
        delayMinutes: input.delayMinutes ?? 0,
        currentStopId: input.currentStopId ?? null,
        nextStopId: input.nextStopId ?? null,
        status: input.status ?? "not_started",
      });
      return { success: true };
    }),

   // 管理PC専用：全バス位置情報（認証必要）
  getAll: adminProcedure.query(async () => {
    return db.getLatestBusLocations();
  }),
  // 管理PC専用：路線別バス位置情報（認証必要）
  getByRoute: adminProcedure
    .input(z.object({ routeId: z.string() }))
    .query(async ({ input }) => {
      return db.getBusLocationsByRoute(input.routeId);
    }),
});

// ==================== OperationLog Router ====================
const operationLogRouter = router({
  create: protectedProcedure
    .input(z.object({
      deviceId: z.string().optional(),
      tripId: z.string().optional(),
      routeId: z.string().optional(),
      eventType: z.string(),
      eventData: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.createOperationLog({
        deviceId: input.deviceId ?? null,
        tripId: input.tripId ?? null,
        routeId: input.routeId ?? null,
        eventType: input.eventType,
        eventData: input.eventData ?? null,
      });
      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.getOperationLogs(input?.limit ?? 100);
    }),
});

// ==================== DeviceState Router ====================
const deviceStateRouter = router({
  // heartbeat + 位置情報送信
  heartbeat: publicProcedure
    .input(z.object({
      deviceId: z.string(),
      latitude: z.string().optional(),
      longitude: z.string().optional(),
      currentStopId: z.string().optional(),
      currentStopName: z.string().optional(),
      delayMinutes: z.number().optional(),
      callPhase: z.string().optional(),
      callBusy: z.boolean().optional(),
      // GPS停留所判定結果
      lastPassedStopId: z.string().optional(),
      lastPassedStopName: z.string().optional(),
      earlyDepartureWarning: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const updateData: Parameters<typeof db.upsertDeviceState>[0] = {
        deviceId: input.deviceId,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        currentStopId: input.currentStopId ?? null,
        currentStopName: input.currentStopName ?? null,
        delayMinutes: input.delayMinutes ?? 0,
        callPhase: input.callPhase ?? 'idle',
        callBusy: input.callBusy ?? false,
        isOnline: true,
        lastSeenAt: new Date(),
        earlyDepartureWarning: input.earlyDepartureWarning ?? false,
      };
      if (input.lastPassedStopId !== undefined) {
        (updateData as any).lastPassedStopId = input.lastPassedStopId;
        (updateData as any).lastPassedStopName = input.lastPassedStopName ?? null;
        (updateData as any).lastPassedAt = new Date();
      }
      await db.upsertDeviceState(updateData);
      // 到着予測自動計算：deviceStatesのdiaId/routeIdからETAを算出しpublicArrivalsを更新
      const state = await db.getDeviceState(input.deviceId);
      if (state?.diaId && state?.routeId) {
        updateArrivalsFromHeartbeat({
          deviceId: input.deviceId,
          vehicleNo: state.vehicleNo,
          driverName: state.driverName,
          routeId: state.routeId,
          diaId: state.diaId,
          delayMinutes: input.delayMinutes ?? 0,
          currentStopId: input.currentStopId,
        }).catch((e: unknown) => console.error("[ETA] heartbeat ETA error:", e));
      }
      return { success: true };
    }),

  // シフト確定情報を保存
  applyShift: publicProcedure
    .input(z.object({
      deviceId: z.string(),
      serviceDate: z.string(),
      routeId: z.string(),
      diaId: z.string(),
      vehicleNo: z.string(),
      driverName: z.string(),
      shiftConfirmed: z.boolean(),
      shiftConfirmedDate: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.upsertDeviceState({
        deviceId: input.deviceId,
        serviceDate: input.serviceDate,
        routeId: input.routeId,
        diaId: input.diaId,
        vehicleNo: input.vehicleNo,
        driverName: input.driverName,
        shiftConfirmed: input.shiftConfirmed,
        shiftConfirmedDate: input.shiftConfirmedDate ?? null,
        isOnline: true,
        lastSeenAt: new Date(),
      });
      return { success: true };
    }),

  // 全端末のリアルタイム状態一覧
  listAll: publicProcedure.query(async () => {
    return db.getAllDeviceStates();
  }),

  // 特定端末の状態取得
  get: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .query(async ({ input }) => {
      return db.getDeviceState(input.deviceId);
    }),
});

// 時刻表取得API（運転支援用）
const timetableRouter = router({
  // ダイヤ区間から時刻表を取得
  getByDia: publicProcedure
    .input(z.object({
      diaId: z.number(),
      routeId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getTimetableByDia(input.diaId, input.routeId);
    }),

  // diaNameで時刻表を取得
  getByDiaName: publicProcedure
    .input(z.object({
      diaName: z.string(),
      routeId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getTimetableByDiaName(input.diaName, input.routeId);
    }),
});

// ==================== 公開用バスロケルーター（外部向け・内部データ非公開） ====================
const publicBuslocRouter = router({
  /** 路線一覧（公開用：routeShortName + routeIdのみ） */
  getRoutes: publicProcedure.query(async () => {
    const routes = await db.getAllRoutes();
    return routes.map(r => ({ routeId: r.routeId, routeShortName: r.routeShortName ?? r.routeId }));
  }),

  /** 路線の停留所一覧（公開用：stopId + stopNameのみ、GPS座標なし） */
  getStops: publicProcedure
    .input(z.object({ routeId: z.string() }))
    .query(async ({ input }) => {
      // まずdiaSegmentsから取得（ダイヤに紐づく停留所）
      const fromDia = await db.getStopsByRouteFromDia(input.routeId);
      if (fromDia.length > 0) {
        return fromDia.map((s: any) => ({ stopId: s.stopId, stopName: s.stopName, stopLat: s.stopLat, stopLon: s.stopLon }));
      }
      // フォールバック：stopsテーブルから
      const fromStops = await db.getStopsByRoute(input.routeId);
      return fromStops.map(s => ({ stopId: s.stopId, stopName: s.stopName ?? s.stopId, stopLat: s.stopLat, stopLon: s.stopLon }));
    }),

  /** 到着予測取得（公開用：最大3本、GPS座標なし） */
  getArrivals: publicProcedure
    .input(z.object({ routeId: z.string(), stopId: z.string() }))
    .query(async ({ input }) => {
      const row = await db.getPublicArrivals(input.routeId, input.stopId);
      if (!row) return { stopName: input.stopId, arrivals: [] };
      return {
        stopName: row.stopName,
        arrivals: (row.arrivals as any[]).slice(0, 3),
        updatedAt: row.updatedAt,
      };
    }),

  /** お知らせ取得（公開用） */
  getNotices: publicProcedure
    .input(z.object({ routeId: z.string().optional(), stopId: z.string().optional() }))
    .query(async ({ input }) => {
      const notices = await db.getPublicNotices(input.routeId, input.stopId);
      return notices.map(n => ({
        id: n.id,
        noticeType: n.noticeType,
        title: n.title,
        content: n.content,
        createdAt: n.createdAt,
      }));
    }),
  /**
   * 公開用バス位置情報
   * 返却値に個人情報（乗務員名・端末・通話状態等）は一切含めない。
   * 返却値：路線・車両番号（匿名化済み）・緯経度・停留所名・遅延分数・更新時刻
   */
  getBusPositions: publicProcedure.query(async () => {
    const positions = await db.getPublicBusPositions();
    return positions.map(p => ({
      routeId: p.routeId,
      vehicleNo: p.vehicleNo,
      latitude: p.latitude,
      longitude: p.longitude,
      currentStopName: p.currentStopName,
      delayMinutes: p.delayMinutes ?? 0,
      lastPassedStopName: p.lastPassedStopName,
      updatedAt: p.updatedAt,
    }));
  }),
});

// ==================== お知らせ管理ルーター（管理PC用） ====================
const noticeRouter = router({
  /** 全お知らせ取得（管理PC用） */
  list: adminProcedure.query(async () => {
    return db.getAllPublicNotices();
  }),

   /** お知らせ作成 */
  create: adminProcedure
    .input(z.object({
      routeId: z.string().optional(),
      stopId: z.string().optional(),
      noticeType: z.enum(["info", "delay", "cancel", "detour", "other"]).default("info"),
      title: z.string().min(1),
      content: z.string().min(1),
      isActive: z.boolean().default(true),
      startsAt: z.string().optional(), // ISO string
      endsAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.createPublicNotice({
        routeId: input.routeId ?? null,
        stopId: input.stopId ?? null,
        noticeType: input.noticeType,
        title: input.title,
        content: input.content,
        isActive: input.isActive,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        createdBy: ctx.user.openId,
      });
      // SSEブロードキャスト：バスロケ画面へ即時反映
      broadcastSSE("notice_updated", {
        action: "create",
        routeId: input.routeId ?? null,
        stopId: input.stopId ?? null,
        noticeType: input.noticeType,
        title: input.title,
        isActive: input.isActive,
        ts: Date.now(),
      });
      return { success: true };
    }),
  /** お知らせ更新 */
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().optional(),
      content: z.string().optional(),
      noticeType: z.enum(["info", "delay", "cancel", "detour", "other"]).optional(),
      isActive: z.boolean().optional(),
      routeId: z.string().nullable().optional(),
      stopId: z.string().nullable().optional(),
      endsAt: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, endsAt, ...rest } = input;
      await db.updatePublicNotice(id, {
        ...rest,
        endsAt: endsAt ? new Date(endsAt) : endsAt === null ? null : undefined,
      });
      // SSEブロードキャスト：バスロケ画面へ即時反映
      broadcastSSE("notice_updated", {
        action: "update",
        id: input.id,
        isActive: input.isActive,
        ts: Date.now(),
      });
      return { success: true };
    }),
  /** お知らせ削除 */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deletePublicNotice(input.id);
      // SSEブロードキャスト：バスロケ画面へ即時反映
      broadcastSSE("notice_updated", {
        action: "delete",
        id: input.id,
        ts: Date.now(),
      });
      return { success: true };
    }),
});

// ==================== システム設定ルーター ====================
const systemSettingsRouter = router({
  /** 全設定一覧（タブレット起動時に取得） */
  list: publicProcedure.query(async () => {
    return db.getAllSystemSettings();
  }),
  /** キーバリューマップで取得（タブレット用） */
  getMap: publicProcedure.query(async () => {
    return db.getSystemSettingsMap();
  }),
  /** 単一設定値を更新（管理PC用） */
  update: adminProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      await db.updateSystemSetting(input.key, input.value);
      return { success: true };
    }),
  /** 設定値を一括更新（管理PC用） */
  bulkUpdate: adminProcedure
    .input(z.object({ updates: z.record(z.string(), z.string()) }))
    .mutation(async ({ input }) => {
      await db.bulkUpdateSystemSettings(input.updates);
      return { success: true };
    }),
});

// ==================== 定型返信ルーター ====================
const quickReplyRouter = router({
  /** タブレット用：有効な定型返信一覧 */
  list: publicProcedure.query(async () => {
    return db.getActiveQuickReplies();
  }),
  /** 管理PC用：全定型返信一覧 */
  listAll: adminProcedure.query(async () => {
    return db.getAllQuickReplies();
  }),
  /** 定型返信作成 */
  create: adminProcedure
    .input(z.object({ content: z.string().min(1).max(256), sortOrder: z.number().optional() }))
    .mutation(async ({ input }) => {
      const id = await db.createQuickReply(input.content, input.sortOrder);
      return { success: true, id };
    }),
  /** 定型返信更新 */
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      content: z.string().min(1).max(256).optional(),
      sortOrder: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateQuickReply(id, data);
      return { success: true };
    }),
  /** 定型返信削除 */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteQuickReply(input.id);
      return { success: true };
    }),
  /** 並び順保存 */
  reorder: adminProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      await db.reorderQuickReplies(input.orderedIds);
      return { success: true };
    }),
});

// ==================== Lines Router (路線名マスタ) ====================
const linesRouter = router({
  getAll: publicProcedure.query(async () => {
    return db.getAllLines();
  }),
  getLinesWithRoutes: publicProcedure.query(async () => {
    return db.getLinesWithRoutes();
  }),
  create: adminProcedure
    .input(z.object({
      lineId: z.string().min(1),
      lineName: z.string().min(1),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.createLine({
        lineId: input.lineId,
        lineName: input.lineName,
        description: input.description ?? null,
        sortOrder: input.sortOrder ?? 0,
      });
      return { success: true };
    }),
  update: adminProcedure
    .input(z.object({
      id: z.number(),
      lineName: z.string().min(1).optional(),
      description: z.string().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.updateLine(id, data);
      return { success: true };
    }),
  delete: adminProcedure
    .input(z.object({ lineId: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteLine(input.lineId);
      return { success: true };
    }),
  merge: adminProcedure
    .input(z.object({ sourceLineId: z.string(), targetLineId: z.string() }))
    .mutation(async ({ input }) => {
      await db.mergeLines(input.sourceLineId, input.targetLineId);
      return { success: true };
    }),
  createRoute: adminProcedure
    .input(z.object({
      routeId: z.string().min(1),
      routeShortName: z.string().optional(),
      routeLongName: z.string().optional(),
      lineId: z.string().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.createRoute({
        routeId: input.routeId,
        routeShortName: input.routeShortName ?? null,
        routeLongName: input.routeLongName ?? null,
        lineId: (input.lineId && input.lineId !== "__none__") ? input.lineId : null,
      });
      return { success: true };
    }),
  deleteRoute: adminProcedure
    .input(z.object({ routeId: z.string() }))
    .mutation(async ({ input }) => {
      await db.deleteRoute(input.routeId);
      return { success: true };
    }),
  setRouteLineId: adminProcedure
    .input(z.object({
      routeId: z.string(),
      lineId: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      await db.setRouteLineId(input.routeId, input.lineId);
      return { success: true };
    }),
  // 系統一覧（lineId付き）
  getAllRoutes: publicProcedure.query(async () => {
    return db.getAllRoutesWithLine();
  }),
  // 系統の手動編集（系統名・路線名紐付け・統合フラグ）
  updateRoute: adminProcedure
    .input(z.object({
      routeId: z.string(),
      routeLongName: z.string().optional(),
      routeShortName: z.string().optional(),
      lineId: z.string().nullable().optional(),
      isMerged: z.boolean().optional(),
      mergedFrom: z.array(z.string()).nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { routeId, ...data } = input;
      await db.updateRoute(routeId, data);
      return { success: true };
    }),
  // ダイヤのlineId更新
  updateDiaLineId: adminProcedure
    .input(z.object({
      id: z.number(),
      lineId: z.string().nullable(),
    }))
    .mutation(async ({ input }) => {
      await db.updateDiaLineId(input.id, input.lineId);
      return { success: true };
    }),
});

// ==================== UI Settings Router ====================
const uiSettingsRouter = router({
  getAll: adminProcedure.query(async () => {
    return db.getAllUiSettings();
  }),
  getMap: publicProcedure.query(async () => {
    return db.getUiSettingsMap();
  }),
  update: adminProcedure
    .input(z.object({ key: z.string(), value: z.string() }))
    .mutation(async ({ input }) => {
      await db.upsertUiSetting(input.key, input.value);
      return { success: true };
    }),
  bulkUpdate: adminProcedure
    .input(z.array(z.object({ key: z.string(), value: z.string() })))
    .mutation(async ({ input }) => {
      await db.bulkUpsertUiSettings(input);
      return { success: true };
    }),
});
// ==================== Traffic Incidents Router ====================
const trafficRouter = router({
  /** 現在地から指定半径内の道路インシデント情報を取得 */
  getIncidents: publicProcedure
    .input(z.object({
      lat: z.number(),
      lng: z.number(),
      radiusMeters: z.number().default(3000),
    }))
    .query(async ({ input }) => {
      const apiKey = process.env.HERE_API_KEY;
      if (!apiKey) {
        // APIキー未設定の場合はモックデータを返す
        return { incidents: [], source: "none" as const, message: "HERE_API_KEY未設定" };
      }
      try {
        const { lat, lng, radiusMeters } = input;
        // HERE Traffic API v7 - incidents endpoint
        const url = new URL("https://data.traffic.hereapi.com/v7/incidents");
        url.searchParams.set("in", `circle:${lat},${lng};r=${radiusMeters}`);
        url.searchParams.set("locationReferencing", "shape");
        url.searchParams.set("apiKey", apiKey);
        const res = await fetch(url.toString());
        if (!res.ok) throw new Error(`HERE API error: ${res.status}`);
        const data = await res.json() as any;
        const incidents = (data.results ?? []).map((r: any) => ({
          id: r.incidentDetails?.id ?? "",
          type: r.incidentDetails?.type ?? "UNKNOWN",
          description: r.incidentDetails?.description?.value ?? "",
          startTime: r.incidentDetails?.startTime ?? null,
          endTime: r.incidentDetails?.endTime ?? null,
          severity: r.incidentDetails?.criticality ?? 0,
          location: r.location?.shape?.links?.[0]?.points?.[0] ?? null,
        }));
        return { incidents, source: "here" as const, message: null };
      } catch (e: any) {
        return { incidents: [], source: "error" as const, message: e.message };
      }
    }),
});

// ==================== Main Router ====================
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  vehicle: vehicleRouter,
  driver: driverRouter,
  gtfs: gtfsRouter,
  dia: diaRouter,
  message: messageRouter,
  callLog: callRouter,
  device: deviceRouter,
  busLocation: busLocationRouter,
  operationLog: operationLogRouter,
  deviceState: deviceStateRouter,
  timetable: timetableRouter,
  publicBusloc: publicBuslocRouter,
  notice: noticeRouter,
  quickReply: quickReplyRouter,
  systemSettings: systemSettingsRouter,
  uiSettings: uiSettingsRouter,
   traffic: trafficRouter,
  line: linesRouter,
});
export type AppRouter = typeof appRouter;
