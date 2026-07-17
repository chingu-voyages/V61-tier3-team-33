interface AuthErrorProps {
    error: string;
  }
  
  export function AuthError({ error }: AuthErrorProps) {
    if (!error) return null;
  
    return (
      <p
        role="alert"
        className="text-sm text-red-500"
      >
        {error}
      </p>
    );
  }