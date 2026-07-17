import { useContext } from "react";

import { AuthContext } from "@/context/auth/AuthContext";

export function useAuth(){

    return useContext(AuthContext);

}