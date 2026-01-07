import { type FastifyInstance } from "fastify";
import {
  CreateRoomRequestSchema,
  UpdateRoomRequestSchema,
} from "@dnd-voice/shared";
import { getRoomQueries } from "../db/index.js";
import { authenticate, requireDM } from "../middleware/auth.js";

interface RoomRow {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  creator_username: string;
}

function transformRoom(row: RoomRow) {
  return {
    id: row.id,
    name: row.name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    creatorUsername: row.creator_username,
  };
}

export async function roomRoutes(fastify: FastifyInstance) {
  // Get all rooms
  fastify.get(
    "/api/rooms",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const queries = getRoomQueries();
        const rooms = queries.getAll.all() as RoomRow[];

        return reply.send({
          rooms: rooms.map(transformRoom),
        });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch rooms" });
      }
    },
  );

  // Get single room
  fastify.get<{ Params: { id: string } }>(
    "/api/rooms/:id",
    {
      preHandler: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const roomId = parseInt(id, 10);

        if (isNaN(roomId)) {
          return reply.status(400).send({ error: "Invalid room ID" });
        }

        const queries = getRoomQueries();
        const room = queries.getById.get(roomId) as RoomRow | undefined;

        if (!room) {
          return reply.status(404).send({ error: "Room not found" });
        }

        return reply.send({ room: transformRoom(room) });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Failed to fetch room" });
      }
    },
  );

  // Create room (DM only)
  fastify.post(
    "/api/rooms",
    {
      preHandler: [authenticate, requireDM],
    },
    async (request, reply) => {
      try {
        const parseResult = CreateRoomRequestSchema.safeParse(request.body);

        if (!parseResult.success) {
          return reply.status(400).send({
            error: "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          });
        }

        const { name } = parseResult.data;
        const userId = request.user!.id;

        const queries = getRoomQueries();
        const result = queries.create.run(name, userId);

        const room = queries.getById.get(result.lastInsertRowid) as RoomRow;

        return reply.status(201).send({ room: transformRoom(room) });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Failed to create room" });
      }
    },
  );

  // Update room (DM only, and must be creator)
  fastify.put<{ Params: { id: string } }>(
    "/api/rooms/:id",
    {
      preHandler: [authenticate, requireDM],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const roomId = parseInt(id, 10);

        if (isNaN(roomId)) {
          return reply.status(400).send({ error: "Invalid room ID" });
        }

        const parseResult = UpdateRoomRequestSchema.safeParse(request.body);

        if (!parseResult.success) {
          return reply.status(400).send({
            error: "Validation failed",
            details: parseResult.error.flatten().fieldErrors,
          });
        }

        const queries = getRoomQueries();
        const existingRoom = queries.getById.get(roomId) as RoomRow | undefined;

        if (!existingRoom) {
          return reply.status(404).send({ error: "Room not found" });
        }

        // Only the creator can update the room
        if (existingRoom.created_by !== request.user!.id) {
          return reply
            .status(403)
            .send({ error: "Only the room creator can update this room" });
        }

        const { name } = parseResult.data;
        queries.update.run(name, roomId);

        const updatedRoom = queries.getById.get(roomId) as RoomRow;

        return reply.send({ room: transformRoom(updatedRoom) });
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Failed to update room" });
      }
    },
  );

  // Delete room (DM only, and must be creator)
  fastify.delete<{ Params: { id: string } }>(
    "/api/rooms/:id",
    {
      preHandler: [authenticate, requireDM],
    },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const roomId = parseInt(id, 10);

        if (isNaN(roomId)) {
          return reply.status(400).send({ error: "Invalid room ID" });
        }

        const queries = getRoomQueries();
        const existingRoom = queries.getById.get(roomId) as RoomRow | undefined;

        if (!existingRoom) {
          return reply.status(404).send({ error: "Room not found" });
        }

        // Only the creator can delete the room
        if (existingRoom.created_by !== request.user!.id) {
          return reply
            .status(403)
            .send({ error: "Only the room creator can delete this room" });
        }

        queries.delete.run(roomId);

        return reply.status(204).send();
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "Failed to delete room" });
      }
    },
  );
}
