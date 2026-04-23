import { useState } from "react";
import API from "../services/api";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async (e) => {
    e.preventDefault();
    try {
    const res = await API.post("/auth/login", { email, password });
    alert(res.data.message);
    } catch (error) {
      console.log(error.response.data);
      alert("Login failed: " + error.response.data.message);
    }
  };

  return (
    <>
     <h1>Employee Login</h1>
      <input placeholder="Email" onChange={e => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" onChange={e => setPassword(e.target.value)} />
      <button onClick={login}>Login</button>
    </>
  );
}

export default Login;