import { Room, Client, matchMaker } from "@colyseus/core";
import { Schema, MapSchema, type } from "@colyseus/schema";

class LobbyPlayer extends Schema {
    @type("string") username: string = "Hero";
    @type("boolean") ready: boolean = false;
    @type("boolean") isHost: boolean = false;
}

export class LobbyState extends Schema {
    @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
    @type("boolean") gameStarted: boolean = false;
}

interface JoinOptions {
    username?: string;
}

// Pre-game lobby. The roomId IS the private code friends use to join:
// the host shares it (or a deep link) and others join by id.
export class LobbyRoom extends Room<LobbyState> {
    maxClients = 4;

    onCreate() {
        this.setState(new LobbyState());

        this.onMessage("ready", (client, ready: boolean) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.ready = !!ready;
            }
        });

        this.onMessage("start", async (client) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || !player.isHost || this.state.gameStarted) {
                return;
            }

            const notReady = Array.from(this.state.players.values()).some(p => !p.ready);
            if (notReady || this.state.players.size === 0) {
                return;
            }

            // Host starts -> create the authoritative match room and
            // hand every lobby client its roomId. The lobby then locks.
            const gameRoom = await matchMaker.createRoom("game", {});
            this.state.gameStarted = true;
            await this.lock();
            this.broadcast("gameStart", { roomId: gameRoom.roomId });
        });
    }

    onJoin(client: Client, options?: JoinOptions) {
        const player = new LobbyPlayer();
        player.username = options?.username || `Hero_${client.sessionId.slice(0, 4)}`;
        player.isHost = this.state.players.size === 0;
        player.ready = player.isHost;
        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client) {
        const leaving = this.state.players.get(client.sessionId);
        this.state.players.delete(client.sessionId);

        // Promote the next player to host so the lobby is never dead.
        if (leaving && leaving.isHost && this.state.players.size > 0) {
            const next = this.state.players.keys().next().value;
            if (next) {
                const nextPlayer = this.state.players.get(next);
                if (nextPlayer) {
                    nextPlayer.isHost = true;
                    nextPlayer.ready = true;
                }
            }
        }
    }
}
