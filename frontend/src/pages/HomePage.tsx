import { useNavigate } from "react-router-dom";

export default function HomePage(){

const navigate=useNavigate();

return(

<div>

<h1>♟ Multiplayer Chess</h1>

<button
onClick={()=>navigate("/create")}
>
Create Room
</button>

<button
onClick={()=>navigate("/join")}
>
Join Room
</button>

</div>

)

}