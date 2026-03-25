import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute: React.FC<{ children: any }> = ({ children }) => {
  const token    = localStorage.getItem("access_token");
  const location = useLocation();

  if (!token) {
    // With HashRouter, save the hash path for redirect after login
    const redirectTo = location.pathname + location.search;
    localStorage.setItem("redirect_after_login", redirectTo);
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;

