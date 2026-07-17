export function validateLogin(email: string, password: string): string | null {
    // 1. Check if email is empty
    if (!email.trim()) {
      return "Email is required";
    }
  
    // 2. Check for a valid email format using regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
  
    // 3. Check if password is empty
    if (!password.trim()) {
      return "Password is required";
    }
  
    // 4. (Optional) Check minimum password length
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
  
    // Return null if all validation passes
    return null;
  }


  // utils/validators.ts

export function validateRegister(
    username: string,
    email: string,
    password: string
  ) {
    if (!username.trim()){
        console.log("Username is required")
      return "Username is required";}
  
    if (!email.trim()){
        console.log("Email  is required")

      return "Email is required";}
  
    if (!password.trim()){
        console.log("Password  is required")

      return "Password is required";}
  
    if (password.length < 8){
        console.log("Password must be at least 8 characters")

      return "Password must be at least 8 characters";}
  
    return null;
  }