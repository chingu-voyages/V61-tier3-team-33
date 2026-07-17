"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { login } from "@/lib/api";

export function useLogin() {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    async function submit(email: string, password: string) {
        try {
            setLoading(true);
            setError("");

            await login({
                email,
                password,
            });

            router.replace("/play");

        } catch (e) {
            if (e instanceof Error) {
                setError(e.message);
            }
        } finally {
            setLoading(false);
        }
    }

    return {
        loading,
        error,
        submit,
    };
}