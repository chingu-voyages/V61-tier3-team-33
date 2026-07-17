interface AuthInputProps {
    id: string;
    label: string;
    type: string;
    value: string;
    placeholder?: string;
    onChange(value: string): void;
  }
  
  export function AuthInput({
    id,
    label,
    type,
    value,
    placeholder,
    onChange,
  }: AuthInputProps) {
    return (
      <div className="space-y-2">
        <label
          htmlFor={id}
          className="text-sm font-medium"
        >
          {label}
        </label>
  
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full
            rounded-lg
            border
            border-neutral-300
            px-4
            py-3
            outline-none
            focus:border-black
          "
        />
      </div>
    );
  }