"use client";

import { useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import { getCurrentUser } from "@/lib/api";

export function AuthProvider({
    children,
}:{
    children:React.ReactNode
}) {

    const [user,setUser]=useState(null);
    const [loading,setLoading]=useState(true);

    async function refreshUser(){

        try{

            const data=await getCurrentUser();

            setUser(data);

        }catch{

            setUser(null);

        }finally{

            setLoading(false);

        }

    }

    useEffect(()=>{

        refreshUser();

    },[]);

    return(

        <AuthContext.Provider
            value={{
                user,
                loading,
                refreshUser
            }}
        >

            {children}

        </AuthContext.Provider>

    );

}