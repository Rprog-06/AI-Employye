import { useState } from "react";
import API from "../services/api";

function ManagerRegister() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: ""
  });

  const register = async (e) => {
    e.preventDefault();
    try{
    await API.post("/auth/register-manager", form);
    alert("Manager Registered. Login now.");
    window.location.href = "/";
    }  catch (err) {
        console.error(err);
      alert(err.response.data.message || "Registration failed");
    }
  };

  return (
    <>
      <h2>Manager Registration</h2>
      <input placeholder="Name" onChange={e => setForm({ ...form, name: e.target.value })} />
      <input placeholder="Email" onChange={e => setForm({ ...form, email: e.target.value })} />
      <input type="password" placeholder="Password"
        onChange={e => setForm({ ...form, password: e.target.value })} />
      <button onClick={register}>Register</button>
    </>
  );
}

export default ManagerRegister;