import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Formik } from "formik";
import * as Yup from "yup";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import TextField from "@mui/material/TextField";
import LoadingButton from "@mui/lab/LoadingButton";

import useAuth from "app/hooks/useAuth";
import { getEmployeeByCode } from "/src/api/account";
import { Paragraph } from "app/components/Typography";
import AuthLayout from "../components/AuthLayout";

const initialValues = {
  employeeCode: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: ""
};

const validationSchema = Yup.object({
  employeeCode: Yup.string()
    .matches(/^\d{1,6}$/, "Employee code must be up to 6 digits")
    .required("Employee code is required"),
  email: Yup.string().email("Enter a valid email").required("Email is required"),
  username: Yup.string().max(100, "Username is too long").required("Username is required"),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .matches(/[A-Z]/, "Password must contain at least one uppercase letter")
    .matches(/[a-z]/, "Password must contain at least one lowercase letter")
    .matches(/[0-9]/, "Password must contain at least one digit")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords must match")
    .required("Please confirm your password")
});

export default function JwtRegister() {
  const navigate = useNavigate();
  const { register, isAuthenticated, user } = useAuth();
  const [errorMessage, setErrorMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState([]);
  const [employeeFullname, setEmployeeFullname] = useState("");
  const [employeeLoading, setEmployeeLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    navigate(user?.mustChangePassword ? "/account/change-password" : "/", { replace: true });
  }, [isAuthenticated, navigate, user?.mustChangePassword]);

  const handleSubmit = async (values) => {
    setErrorMessage("");
    setErrorDetails([]);

    try {
      await register(
        values.email.trim(),
        values.username.trim(),
        values.password,
        values.confirmPassword,
        values.employeeCode.trim()
      );
    } catch (error) {
      const data = error?.response?.data;
      setErrorMessage(data?.message || error.message || "Registration failed.");
      setErrorDetails(Array.isArray(data?.errors) ? data.errors : []);
    }
  };

  const handleEmployeeCodeBlur = async (event, setFieldError) => {
    const code = event.target.value?.trim();
    setEmployeeFullname("");

    if (!code) return;

    setEmployeeLoading(true);

    try {
      const data = await getEmployeeByCode(code);
      const fullName = data?.data?.fullName ?? data?.data?.fullname ?? data?.data?.name ?? "";

      setEmployeeFullname(fullName);
      if (!fullName) setFieldError("employeeCode", "Employee not found.");
    } catch {
      setEmployeeFullname("");
      setFieldError("employeeCode", "Employee not found.");
    } finally {
      setEmployeeLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Create an account to access checksheet submissions, approvals, repair records."
      systemName="MTA CheckSheet System"
      image="/assets/images/icon.svg"
      imageAlt="MTA CheckSheet"
      footer={
        <Paragraph color="text.secondary">
          Already have an account?
          <Link component={NavLink} to="/session/signin" sx={{ ml: 0.75 }}>
            Sign in
          </Link>
        </Paragraph>
      }
    >
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({
          values,
          errors,
          touched,
          isSubmitting,
          setFieldError,
          handleBlur,
          handleChange,
          handleSubmit: submitForm
        }) => (
          <form onSubmit={submitForm}>
            {errorMessage && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {errorMessage}
                {errorDetails.length > 0 && (
                  <ul style={{ margin: "0.5em 0 0", paddingLeft: "1.5em" }}>
                    {errorDetails.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                )}
              </Alert>
            )}

            <TextField
              fullWidth
              size="small"
              name="employeeCode"
              label="NIK"
              placeholder="Max 6 digits"
              value={values.employeeCode}
              onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "").slice(0, 6);
                handleChange({ target: { name: "employeeCode", value } });
              }}
              onBlur={(event) => {
                handleBlur(event);
                handleEmployeeCodeBlur(event, setFieldError);
              }}
              error={Boolean(touched.employeeCode && errors.employeeCode)}
              helperText={touched.employeeCode && errors.employeeCode}
              inputProps={{ maxLength: 6, inputMode: "numeric", pattern: "[0-9]*" }}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              size="small"
              label="Fullname"
              value={employeeFullname}
              InputProps={{ readOnly: true }}
              placeholder={employeeLoading ? "Loading..." : "Blur NIK to fetch"}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              size="small"
              name="email"
              label="Email"
              type="email"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(touched.email && errors.email)}
              helperText={touched.email && errors.email}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              size="small"
              name="username"
              label="Username"
              value={values.username}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(touched.username && errors.username)}
              helperText={touched.username && errors.username}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              size="small"
              name="password"
              label="Password"
              type="password"
              value={values.password}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(touched.password && errors.password)}
              helperText={touched.password && errors.password}
              sx={{ mb: 2 }}
            />

            <TextField
              fullWidth
              size="small"
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              value={values.confirmPassword}
              onChange={handleChange}
              onBlur={handleBlur}
              error={Boolean(touched.confirmPassword && errors.confirmPassword)}
              helperText={touched.confirmPassword && errors.confirmPassword}
              sx={{ mb: 3 }}
            />

            <LoadingButton
              fullWidth
              type="submit"
              variant="contained"
              loading={isSubmitting}
              sx={{ py: 1.1 }}
            >
              Create Account
            </LoadingButton>
          </form>
        )}
      </Formik>
    </AuthLayout>
  );
}
