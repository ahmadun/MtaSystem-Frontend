import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { Formik } from "formik";
import * as Yup from "yup";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import LoadingButton from "@mui/lab/LoadingButton";

import useAuth from "app/hooks/useAuth";
import { Paragraph } from "app/components/Typography";
import AuthLayout from "../components/AuthLayout";

const initialValues = {
  username: "",
  password: ""
};

const validationSchema = Yup.object().shape({
  password: Yup.string()
    .min(6, "Password must be at least 6 characters")
    .required("Password is required"),
  username: Yup.string().required("Username is required")
});

export default function JwtLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, user } = useAuth();
  const [loginError, setLoginError] = useState("");

  useEffect(() => {
    if (!isAuthenticated) return;

    navigate(
      user?.mustChangePassword ? "/account/change-password" : location.state?.from?.pathname || "/",
      { replace: true }
    );
  }, [isAuthenticated, location.state, navigate, user?.mustChangePassword]);

  const handleFormSubmit = async (values) => {
    setLoginError("");

    try {
      await login(values.username, values.password);
    } catch (error) {
      setLoginError(error?.response?.data?.message || error.message || "Invalid username or password.");
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage checksheet submissions, approvals, repair records."
      systemName="MTA CheckSheet System"
      image="/assets/images/icon.svg"
      imageAlt="MTA CheckSheet"
      footer={
        <Paragraph color="text.secondary">
          Don&apos;t have an account?
          <Link component={NavLink} to="/session/signup" sx={{ ml: 0.75 }}>
            Register
          </Link>
        </Paragraph>
      }
    >
      <Formik
        onSubmit={handleFormSubmit}
        initialValues={initialValues}
        validationSchema={validationSchema}
      >
        {({
          values,
          errors,
          touched,
          isSubmitting,
          handleChange,
          handleBlur,
          handleSubmit
        }) => (
          <form onSubmit={handleSubmit}>
            {loginError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {loginError}
              </Alert>
            )}

            <TextField
              fullWidth
              size="small"
              type="text"
              name="username"
              label="Username"
              variant="outlined"
              onBlur={handleBlur}
              value={values.username}
              onChange={handleChange}
              helperText={touched.username && errors.username}
              error={Boolean(errors.username && touched.username)}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              size="small"
              name="password"
              type="password"
              label="Password"
              variant="outlined"
              onBlur={handleBlur}
              value={values.password}
              onChange={handleChange}
              helperText={touched.password && errors.password}
              error={Boolean(errors.password && touched.password)}
              sx={{ mb: 1.5 }}
            />

            <Box display="flex" justifyContent="flex-end" alignItems="center" sx={{ mb: 2 }}>
              <Link component={NavLink} to="/session/forgot-password" underline="hover">
                Forgot password?
              </Link>
            </Box>

            <LoadingButton
              fullWidth
              type="submit"
              color="primary"
              loading={isSubmitting}
              variant="contained"
              sx={{ py: 1.1 }}
            >
              Sign In
            </LoadingButton>
          </form>
        )}
      </Formik>
    </AuthLayout>
  );
}
