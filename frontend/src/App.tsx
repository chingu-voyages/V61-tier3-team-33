import { useEffect, useRef } from "react";
import "./App.css";

function App() {
  const socketRef=useRef<WebSocket|null>(null);
  useEffect(()=>{
    const socket=new WebSocket('ws://localhost:3500/ws');
   

    socket.onopen=()=>{
      console.log("UI connected");
    }
    socket.onmessage=(msg)=>{
      const data=JSON.parse(msg.data);
      if(data.type==='connected'){
        console.log(data.id)
      console.log("Yo message is received :",msg)}
    }

    socket.onerror=(err)=>{
      console.error(err);
    }
    return ()=>{
      socket.close();
    }
  },[])
  return (
    <div className="app">
      <h1>Chess</h1>
    </div>
  );
}

export default App;
