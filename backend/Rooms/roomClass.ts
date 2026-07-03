import { Chess } from "../src/chess";
import type { TimeControl, ClockState } from "./room.type";

export class Room{
    public id: string;//unique roomId
    public players: string[];
    public whitePlayer:string;
    public blackPlayer:string|null;

    public gameStatus:"active"|"over"|"waiting";
    public chess:Chess;

    public timeControl:TimeControl|null=null;
    public whitePlayerTimeMs:number|null=null;
    public blackPlayerTimeMs:number|null=null;
    public lastMoveAt:number|null=null;
    public asyncMoveDeadline:number|null=null;

    //everytime a room is created...roomId and creatorID is stored
    constructor(id:string,creatorId:string){
        this.id=id;
        this.players=[creatorId];
        //creator is the first player
        this.whitePlayer=creatorId;
        this.blackPlayer=null;
        this.gameStatus="waiting";
        this.chess=new Chess();
    }

   public addPlayer(userId:string):boolean{
        if(this.players.length>=2){
            return false
        }
        if(this.players.includes(userId)){
            console.log("user already exists")
            return false
        }

        this.players.push(userId);
        this.blackPlayer=userId
        if(this.players.length==2){
            this.gameStatus='active';
        }
        console.log("Player 2 joined successfully")
        return true
    }

   public removePlayer(userId:string):void{

       this.players=this.players.filter(id=>id!==userId);
        console.log("The user",`${userId}`,"has left");

        if(this.players.length===0){
            this.gameStatus="over";
        }else if(this.players.length===1){
            this.gameStatus='waiting';

            setTimeout(()=>{
                this.closeGame();
               },15000)
        }
       
    }

    public isFull():boolean{
        if(this.players.length<2){
            return false
        }
        return true
    }

    public isActive():boolean{
        if(this.gameStatus==='active'){
            return true
        }
        return false
    }
    

   public closeGame():void{
        this.gameStatus='over'
    
    }

    public setTimeControl(tc: TimeControl): void {
        this.timeControl = tc;
        if (tc.mode === "timed") {
            const totalMs = (tc.minutes * 60 + tc.seconds) * 1000 + (tc.ms ?? 0);
            this.whitePlayerTimeMs = totalMs;
            this.blackPlayerTimeMs = totalMs;
        }
    }

    public startClock(): void {
        if (!this.timeControl) return;
        if (this.timeControl.mode === "async") {
            this.asyncMoveDeadline = Date.now() + 5 * 60 * 1000; // 5 minutes in milliseconds counting from now
        } else {
            this.lastMoveAt = Date.now();
        }
    }

    public onMoveMade(mover: "white" | "black"): { flagFall: boolean; loser?: "white" | "black" } {
        if (!this.timeControl) return { flagFall: false };

        if (this.timeControl.mode === "async") {
            if (this.asyncMoveDeadline && Date.now() > this.asyncMoveDeadline) {
                return { flagFall: true, loser: mover };
            } 
            this.asyncMoveDeadline = Date.now() + 5 * 60 * 1000; // reset deadline for the next move
            return { flagFall: false };
        }

        if (this.lastMoveAt !== null) {
            const used = Date.now() - this.lastMoveAt;
            if (mover === "white") {
                this.whitePlayerTimeMs = Math.max(0, (this.whitePlayerTimeMs ?? 0) - used);
                if (this.whitePlayerTimeMs === 0) return { flagFall: true, loser: "white" };
            } else {
                this.blackPlayerTimeMs = Math.max(0, (this.blackPlayerTimeMs ?? 0) - used);
                if (this.blackPlayerTimeMs === 0) return { flagFall: true, loser: "black" };
            }
        }

        this.lastMoveAt = Date.now();
        return { flagFall: false };
    }

    public getClockState(): ClockState {
        return {
            whitePlayerTimeMs: this.whitePlayerTimeMs,
            blackPlayerTimeMs: this.blackPlayerTimeMs,
            timeControl: this.timeControl
        };
    }
}