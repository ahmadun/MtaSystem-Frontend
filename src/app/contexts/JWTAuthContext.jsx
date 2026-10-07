import { createContext, useEffect, useReducer } from "react";
import { jwtDecode } from "jwt-decode";
import axios from "axios";
import Loading from "app/components/MatxLoading";
import { registerUser } from "/src/api/account";
import { getMyProfile } from "/src/api/account";
import { refreshAccessToken } from "/src/api/client";

const API_BASE = import.meta.env.VITE_API_ENDPOINT;

const initialState = {
  user: null,
  isInitialized: false,
  isAuthenticated: false
};

const claim = (decodedToken, ...keys) => {
  for (const key of keys) {
    const value = decodedToken?.[key];
    if (value !== undefined && value !== null && !(typeof value === "string" && !value.trim())) {
      return value;
    }
  }

  return undefined;
};

const isValidToken = (accessToken) => {
  if (!accessToken) return false;
  try {
    const decodedToken = jwtDecode(accessToken);
    return Boolean(decodedToken?.sub && decodedToken.exp * 1000 > Date.now());
  } catch {
    return false;
  }
};

const setSession = (accessToken, refreshToken) => {
  if (accessToken) {
    localStorage.setItem("accessToken", accessToken);
    if (refreshToken) {
      localStorage.setItem("refreshToken", refreshToken);
    }
    axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
  } else {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    delete axios.defaults.headers.common.Authorization;
  }
};

const toBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no", ""].includes(normalized)) return false;
  }

  if (typeof value === "number") return value === 1;

  return Boolean(value);
};

const buildUser = (data) => {
  const username = data.username;
  const fullName = [data.fullName, data.fullname, data.employeeName, data.name]
    .find((value) => typeof value === "string" && value.trim())
    ?.trim();

  return {
    id: data.userId ?? data.id,
    username,
    fullName: fullName || username,
    email: data.email,
    role: data.role,
    employeeId: data.employeeId,
    mustChangePassword: toBoolean(data.mustChangePassword),
    isActive: data.isActive,
    phoneNumber: data.phoneNumber,
    department: data.department
  };
};

const reducer = (state, action) => {
  switch (action.type) {
    case "INIT": {
      const { isAuthenticated, user } = action.payload;
      return { ...state, user, isAuthenticated, isInitialized: true };
    }
    case "LOGIN": {
      const { user } = action.payload;
      return { ...state, user, isAuthenticated: true };
    }
    case "LOGOUT": {
      return { ...state, isAuthenticated: false, user: null };
    }
    case "REGISTER": {
      const { user } = action.payload;
      return { ...state, isAuthenticated: true, user };
    }
    default: {
      return state;
    }
  }
};

const AuthContext = createContext({
  ...initialState,
  method: "JWT"
});

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const login = async (username, password) => {
    const response = await axios.post(`${API_BASE}/Auth/login`, {
      username,
      password
    });

    const { success, message, data } = response.data;

    if (!success) {
      throw new Error(message || "Invalid username or password.");
    }

    const { token, refreshToken } = data;
    const user = buildUser(data);

    setSession(token, refreshToken);
    dispatch({ type: "LOGIN", payload: { user } });
  };

  const register = async (email, username, password, confirmPassword = password, employeeCode) => {
    const payload = { email, username, password, confirmPassword };
    if (employeeCode) payload.employeeCode = employeeCode;
    const response = await registerUser(payload);
    const { success, message, data } = response;

    if (!success) {
      throw new Error(message || "Registration failed.");
    }

    const { token, refreshToken } = data;
    const user = buildUser(data);

    setSession(token, refreshToken);
    dispatch({ type: "REGISTER", payload: { user } });
  };

  const logout = () => {
    setSession(null);
    dispatch({ type: "LOGOUT" });
  };

  const refreshUser = (userData) => {
    dispatch({ type: "LOGIN", payload: { user: buildUser(userData) } });
  };

  useEffect(() => {
    (async () => {
      try {
        let accessToken = window.localStorage.getItem("accessToken");

        if (!isValidToken(accessToken) && window.localStorage.getItem("refreshToken")) {
          accessToken = await refreshAccessToken();
        }

        if (accessToken && isValidToken(accessToken)) {
          setSession(accessToken);
          const decoded = jwtDecode(accessToken);
          let user;

          try {
            const profileResponse = await getMyProfile();
            user = buildUser(profileResponse?.data ?? profileResponse);
          } catch (profileError) {
            if (!window.localStorage.getItem("accessToken")) throw profileError;
            console.warn("Falling back to JWT claims for user initialization.", profileError);
            user = buildUser({
              id: claim(decoded, "sub", "nameid"),
              username: claim(decoded, "unique_name", "username"),
              fullName: claim(decoded, "fullName", "name"),
              email: claim(decoded, "email"),
              role: claim(
                decoded,
                "role",
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/role"
              ),
              employeeId: claim(decoded, "employee_id", "employeeId"),
              mustChangePassword: claim(
                decoded,
                "mustChangePassword",
                "must_change_password",
                "force_password_change"
              )
            });
          }

          dispatch({
            type: "INIT",
            payload: { isAuthenticated: true, user }
          });
        } else {
          console.log("No valid token found, logging out", accessToken);
          dispatch({
            type: "INIT",
            payload: { isAuthenticated: false, user: null }
          });
        }
      } catch (err) {
        console.error(err);
        dispatch({
          type: "INIT",
          payload: { isAuthenticated: false, user: null }
        });
      }
    })();
  }, []);

  if (!state.isInitialized) return <Loading />;

  return (
    <AuthContext.Provider
      value={{ ...state, method: "JWT", login, logout, refreshUser, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
