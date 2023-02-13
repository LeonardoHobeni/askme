import {
  joinSpaceSchema,
  onUserJoinSpaceSchema,
  onUserLeaveSpaceSchema,
} from "../../schema/spaces.schema";
import { publicProcedure, router } from "../../trpc/trpc";
import haversine from "haversine-distance";
import { Events } from "../../constants";
import { observable } from "@trpc/server/observable";
import EventEmitter from "events";
import { verifyJwt } from "../../utils";
import { User } from "@prisma/client";

interface SpaceType {
  user: User;
  id: string;
  lat: number;
  lon: number;
  userId: string;
}

const ee = new EventEmitter({
  captureRejections: true,
});
export const spacesRouter = router({
  joinSpace: publicProcedure
    .input(joinSpaceSchema)
    .mutation(async ({ input: { lat, lon }, ctx: { prisma, req } }) => {
      try {
        const jwt = req.headers?.authorization?.split(/\s/)[1];
        const { id } = await verifyJwt(jwt as string);
        const me = await prisma.user.findFirst({ where: { id } });
        if (!!!me) {
          return {
            error: {
              field: "user",
              message: "The user can not be found.",
            },
          };
        }

        const _location = await prisma.location.findFirst({
          where: {
            userId: me.id,
          },
        });

        if (!!_location) {
          const __location = await prisma.location.update({
            where: {
              id: _location.id,
            },
            include: {
              user: true,
            },
            data: {
              lat,
              lon,
            },
          });
          ee.emit(Events.ON_USER_JOIN_SPACE, __location);
          return { location: __location };
        }
        const location = await prisma.location.create({
          data: {
            lat,
            lon,
            user: {
              connect: {
                id: me.id,
              },
            },
          },
          include: {
            user: true,
          },
        });
        ee.emit(Events.ON_USER_JOIN_SPACE, location);
        return { location };
      } catch (error) {
        return {
          error: {
            message: "Unable to find the user for whatever reason",
            field: "me",
          },
        };
      }
    }),

  myLocation: publicProcedure.query(async ({ ctx: { req, prisma } }) => {
    try {
      const jwt = req.headers?.authorization?.split(/\s/)[1];
      const { id } = await verifyJwt(jwt as string);
      const me = await prisma.user.findFirst({ where: { id } });
      if (!!!me) {
        return {
          error: {
            field: "user",
            message: "The user can not be found.",
          },
        };
      }
      //
      const location = await prisma.location.findFirst({
        where: {
          userId: me.id,
        },
        include: {
          user: true,
        },
      });

      return { location };
    } catch (error) {
      return {
        error: {
          message: "Unable to find the user for whatever reason",
          field: "me",
        },
      };
    }
  }),
  leaveSpace: publicProcedure.mutation(async ({ ctx: { req, prisma } }) => {
    try {
      const jwt = req.headers?.authorization?.split(/\s/)[1];
      const { id } = await verifyJwt(jwt as string);
      const me = await prisma.user.findFirst({ where: { id } });
      if (!!!me) {
        return {
          error: {
            field: "user",
            message: "The user can not be found.",
          },
        };
      }
      const location = await prisma.location.update({
        where: {
          userId: me.id,
        },
        data: {
          lat: 0,
          lon: 0,
        },
        select: {
          user: true,
        },
      });
      ee.emit(Events.ON_USER_LEAVE_SPACE, location);
      return { location };
    } catch (error) {
      return {
        error: {
          message: "Unable to find the user for whatever reason",
          field: "me",
        },
      };
    }
  }),
  mySpace: publicProcedure.query(async ({ ctx: { req, prisma } }) => {
    try {
      const jwt = req.headers?.authorization?.split(/\s/)[1];
      const { id } = await verifyJwt(jwt as string);
      const me = await prisma.user.findFirst({ where: { id } });
      if (!!!me) {
        return {
          error: {
            field: "user",
            message: "The user can not be found.",
          },
        };
      }
      //
      const spaces = await prisma.location.findMany({
        where: {
          NOT: {
            lat: 0,
            AND: {
              lon: 0,
            },
          },
        },
        include: {
          user: true,
        },
      });

      return { spaces };
    } catch (error) {
      return {
        error: {
          message: "Unable to find the user for whatever reason",
          field: "me",
        },
      };
    }
  }),

  onUserJoinSpace: publicProcedure
    .input(onUserJoinSpaceSchema)
    .subscription(async ({ input: { userId } }) => {
      return observable<SpaceType>((emit) => {
        const onMessage = (space: SpaceType) => {
          if (userId !== space.userId) {
            emit.next(space);
          }
        };
        ee.on(Events.ON_USER_JOIN_SPACE, onMessage);
        return () => {
          ee.off(Events.ON_USER_JOIN_SPACE, onMessage);
        };
      });
    }),

  onUserLeaveSpace: publicProcedure
    .input(onUserLeaveSpaceSchema)
    .subscription(async ({ input: { userId } }) => {
      return observable<SpaceType>((emit) => {
        const onMessage = (space: SpaceType) => {
          if (userId !== space.userId) {
            emit.next(space);
          }
        };
        ee.on(Events.ON_USER_LEAVE_SPACE, onMessage);
        return () => {
          ee.off(Events.ON_USER_LEAVE_SPACE, onMessage);
        };
      });
    }),
});
