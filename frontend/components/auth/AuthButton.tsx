interface AuthButtonProps {
    loading: boolean;
    text: string;
    loadingText: string;
  }
  
  export function AuthButton({
    loading,
    text,
    loadingText,
  }: AuthButtonProps) {
    return (
      <button
        type="submit"
        disabled={loading}
        className="
          w-full
          rounded-lg
          bg-black
          py-3
          text-white
          transition
          hover:bg-neutral-800
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {loading ? loadingText : text}
      </button>
    );
  }