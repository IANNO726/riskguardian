import React from "react";
import { Navigate, useLocation } from "react-router-dom";

const ProtectedRoute: React.FC<{ children: any }> = ({ children }) => {
  const token    = localStorage.getItem("access_token");
  const location = useLocation();

  if (!token) {
    // Save where the user was trying to go
    localStorage.setItem("redirect_after_login", location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;

