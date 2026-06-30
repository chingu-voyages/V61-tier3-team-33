import { Chess } from "../src/chess";

export class Room{
    public id: string;//unique roomId
    public players: string[];
    public whitePlayer:string;
    public blackPlayer:string|null;

    public gameStatus:"active"|"over"|"waiting";
    public chess:Chess;

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

}