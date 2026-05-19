import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import useAuth from "app/hooks/useAuth";

const RoleGuard = ({ roles = [], children }) => {
  const { user } = useAuth();

  if (!roles.length || roles.includes(user?.role)) return <>{children}</>;

  return (
    <Box sx={{ p: 3 }}>
      <Alert severity="warning">You do not have access to this page.</Alert>
    </Box>
  );
};

export default RoleGuard;
