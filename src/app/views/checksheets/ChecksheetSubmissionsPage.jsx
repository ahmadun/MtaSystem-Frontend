import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LaunchIcon from "@mui/icons-material/Launch";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import RefreshIcon from "@mui/icons-material/Refresh";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { getChecksheetSubmissions } from "@api/checksheets";
import { authRoles } from "app/auth/authRoles";
import { ConfirmationDialog } from "app/components";
import useAuth from "app/hooks/useAuth";
import {
  useChecksheetAreas,
  useChecksheetGroups,
  useChecksheetLines,
  useChecksheetMachine,
  useChecksheetMachines,
  useChecksheetMasters,
  useChecksheetSubmissions,
  useCreateChecksheetSubmission,
  useDeleteChecksheetSubmission
} from "app/hooks/useChecksheets";

const SHIFT_OPTIONS = ["1", "2", "3"];
const SUBMISSION_STATUS_OPTIONS = ["draft", "submitted", "approved", "rejected", "cancelled"];
const defaultInspectionDate = () => new Date().toISOString().slice(0, 10);

function formatSubmissionStatus(status) {
  return typeof status === "string" ? status.toUpperCase() : "-";
}

function getMonthRange(dateValue) {
  if (!dateValue) {
    return { from: undefined, to: undefined };
  }

  const [year, month] = String(dateValue).slice(0, 7).split("-").map(Number);
  if (!year || !month) {
    return { from: undefined, to: undefined };
  }

  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const toDate = new Date(year, month, 0);
  const to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
  return { from, to };
}

function monthValueToDate(monthValue) {
  if (!monthValue) {
    return null;
  }

  const [year, month] = String(monthValue).slice(0, 7).split("-").map(Number);
  if (!year || !month) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function dateToMonthValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(dateValue) {
  if (!dateValue) {
    return "this month";
  }

  const parsedDate = new Date(`${String(dateValue).slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(dateValue).slice(0, 7);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(parsedDate);
}

function formatMonthPeriod(dateValue) {
  if (!dateValue) {
    return "-";
  }

  return formatMonthLabel(dateValue);
}

function buildGroupOptions(allGroups, machine) {
  const allowedGroupCodes = new Set(machine?.groupCodes ?? []);
  return (allGroups ?? []).filter((group) => allowedGroupCodes.has(group.groupCode));
}

function normalizeGroupCodes(groupValue) {
  if (Array.isArray(groupValue)) {
    return groupValue
      .map((code) => String(code ?? "").trim().toLowerCase())
      .filter(Boolean)
      .sort();
  }

  if (typeof groupValue === "string") {
    const rawValue = groupValue.trim();
    if (!rawValue) {
      return [];
    }

    try {
      const parsedValue = JSON.parse(rawValue);
      if (Array.isArray(parsedValue)) {
        return normalizeGroupCodes(parsedValue);
      }
    } catch {
      // fallback to comma-separated parsing
    }

    return rawValue
      .split(",")
      .map((code) => code.trim().toLowerCase())
      .filter(Boolean)
      .sort();
  }

  return [];
}

function hasSameGroupSelection(item, selectedGroupCodes) {
  const itemGroupCodes = normalizeGroupCodes(item.groupCodes ?? item.groupCodesJson ?? item.groupCode);
  if (itemGroupCodes.length !== selectedGroupCodes.length) {
    return false;
  }

  return itemGroupCodes.every((code, index) => code === selectedGroupCodes[index]);
}

async function findExistingMonthlySubmissions(machineCode, inspectionDate, groupCodes) {
  const { from, to } = getMonthRange(inspectionDate);
  const response = await getChecksheetSubmissions({
    page: 1,
    pageSize: 100,
    machineCode,
    inspectionDateFrom: from,
    inspectionDateTo: to
  });
  const responseItems = response?.items ?? response?.data?.items ?? [];
  const normalizedSelectedGroups = normalizeGroupCodes(groupCodes);

  return responseItems.filter((item) => {
    if (item.machineCode !== machineCode) {
      return false;
    }

    if (!hasSameGroupSelection(item, normalizedSelectedGroups)) {
      return false;
    }

    const itemMonth = String(item.inspectionDate ?? "").slice(0, 7);
    const requestedMonth = String(inspectionDate ?? "").slice(0, 7);
    return itemMonth && itemMonth === requestedMonth;
  });
}

function ExistingSubmissionDialog({ open, pending, duplicates, inspectionDate, onClose, onUseExisting, onCreateNew }) {
  const monthLabel = formatMonthLabel(inspectionDate);

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Existing Submission Found</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning">
            A submission for the same machine and group already exists in {monthLabel}. Choose whether to continue with the existing submission or create a new one anyway.
          </Alert>
          <Stack spacing={1.5}>
            {duplicates.map((submission) => (
              <Paper key={submission.id} variant="outlined" sx={{ p: 2 }}>
                <Stack spacing={0.5}>
                  <Typography fontWeight={600}>{submission.machineCode}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {submission.inspectionDate} | Shift {submission.shift} | {formatSubmissionStatus(submission.status)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Group: {submission.groupCodes?.join(", ") || "-"}
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={pending}>Cancel</Button>
        <Button onClick={onCreateNew} disabled={pending}>
          {pending ? "Creating..." : "Create New"}
        </Button>
        <Button variant="contained" onClick={onUseExisting} disabled={pending || duplicates.length === 0}>
          Use Existing
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ScanToOpenDialog({ open, targetSubmission, onClose, onOpenSubmission }) {
  const readerElementIdRef = useRef(`submission-open-qr-reader-${Math.random().toString(36).slice(2)}`);
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const [scanSession, setScanSession] = useState(0);
  const [scanState, setScanState] = useState("idle");
  const [scanErrorMessage, setScanErrorMessage] = useState("");
  const [scannedMachineCode, setScannedMachineCode] = useState("");

  useEffect(() => {
    if (!open) {
      setScannedMachineCode("");
      setScanState("idle");
      setScanErrorMessage("");
      return;
    }

    if (scannedMachineCode) {
      return undefined;
    }

    let isCancelled = false;

    const stopScanner = async () => {
      const scanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;

      if (!scanner) {
        return;
      }

      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // ignore stop failures during dialog close/reopen
      }

      try {
        await scanner.clear();
      } catch {
        // ignore clear failures
      }
    };

    const startScanner = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setScanState("unsupported");
        setScanErrorMessage("Camera scanning requires HTTPS or a secure local environment.");
        return;
      }

      try {
        setScanState("starting");
        setScanErrorMessage("");
        const scanner = new Html5Qrcode(readerElementIdRef.current, { verbose: false });
        html5QrCodeRef.current = scanner;

        setScanState("scanning");
        const onScanSuccess = async (decodedText) => {
          const rawValue = decodedText?.trim();
          if (!rawValue) {
            return;
          }

          setScannedMachineCode(rawValue);
          setScanState("detected");
          await stopScanner();
        };

        const scanConfig = {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1
        };

        const startCandidates = [
          { facingMode: "environment" },
          { facingMode: { exact: "environment" } }
        ];

        try {
          const cameras = await Html5Qrcode.getCameras();
          const preferredCamera =
            cameras.find((camera) => /back|rear|environment/i.test(camera.label))?.id ?? cameras[0]?.id;
          if (preferredCamera) {
            startCandidates.push(preferredCamera);
          }
        } catch {
          // keep facingMode-only fallbacks
        }

        let started = false;
        for (const candidate of startCandidates) {
          if (isCancelled || started) {
            break;
          }

          try {
            await scanner.start(candidate, scanConfig, onScanSuccess, () => { });
            started = true;
          } catch {
            // try next startup strategy
          }
        }

        if (!started) {
          throw new Error("Unable to start the camera scanner on this browser or device.");
        }
      } catch (error) {
        setScanState("error");
        setScanErrorMessage(error?.message || "Camera start or QR detection failed.");
        await stopScanner();
      }
    };

    startScanner();

    return () => {
      isCancelled = true;
      stopScanner();
    };
  }, [open, scanSession, scannedMachineCode]);

  const expectedMachineCode = targetSubmission?.machineCode ?? "";
  const isMatch = scannedMachineCode && expectedMachineCode &&
    String(scannedMachineCode).trim().toLowerCase() === String(expectedMachineCode).trim().toLowerCase();

  const handleClose = () => {
    onClose();
    setScannedMachineCode("");
    setScanState("idle");
    setScanErrorMessage("");
    setScanSession((current) => current + 1);
  };

  const handleRescan = () => {
    setScannedMachineCode("");
    setScanState("idle");
    setScanErrorMessage("");
    setScanSession((current) => current + 1);
  };

  const handleImageSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setScanState("starting");
      setScanErrorMessage("");
      const scanner = new Html5Qrcode(readerElementIdRef.current, { verbose: false });
      const decodedText = await scanner.scanFile(file, true);
      await scanner.clear();
      const rawValue = decodedText?.trim();
      if (!rawValue) {
        throw new Error("No QR code was detected in the selected image.");
      }
      setScannedMachineCode(rawValue);
      setScanState("detected");
    } catch (error) {
      setScanState("error");
      setScanErrorMessage(error?.message || "Image QR scan failed.");
    } finally {
      event.target.value = "";
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Scan Machine QR To Open</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Alert severity="info">
            Scan the QR code for machine <strong>{expectedMachineCode || "-"}</strong> to open this submission.
          </Alert>

          {!scannedMachineCode && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: "#0f172a",
                color: "#e2e8f0"
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Camera Scanner
                </Typography>
                <Box
                  sx={{
                    position: "relative",
                    borderRadius: 2,
                    overflow: "hidden",
                    bgcolor: "#020617",
                    minHeight: 280
                  }}
                >
                  <Box
                    id={readerElementIdRef.current}
                    sx={{
                      width: "100%",
                      height: { xs: 280, md: 360 },
                      "& video": {
                        width: "100% !important",
                        height: "100% !important",
                        objectFit: "cover"
                      }
                    }}
                  />
                  {scanState === "starting" && (
                    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(2,6,23,0.6)" }}>
                      <Typography variant="body2">Starting camera...</Typography>
                    </Box>
                  )}
                </Box>
                {scanErrorMessage && <Alert severity="error">{scanErrorMessage}</Alert>}
                <Typography variant="caption" color="inherit">
                  The QR code value must match the selected submission machine code.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" color="inherit" onClick={() => fileInputRef.current?.click()}>
                    Scan From Photo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={handleImageSelection}
                  />
                </Stack>
              </Stack>
            </Paper>
          )}

          {scannedMachineCode && (
            <Stack spacing={1.5}>
              <Chip
                color={isMatch ? "success" : "error"}
                variant="outlined"
                label={`Scanned: ${scannedMachineCode}`}
              />
              {!isMatch && (
                <Alert severity="error">
                  QR machine code does not match this row. Expected {expectedMachineCode}, scanned {scannedMachineCode}.
                </Alert>
              )}
            </Stack>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        {scannedMachineCode && (
          <Button onClick={handleRescan}>
            Rescan
          </Button>
        )}
        <Button
          variant="contained"
          disabled={!isMatch}
          onClick={() => {
            if (!targetSubmission) return;
            onOpenSubmission(targetSubmission.id);
            handleClose();
          }}
        >
          Open Submission
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AdminCreateSubmissionDialog({ open, onClose, navigate, onResolveDuplicate }) {
  const machinesQuery = useChecksheetMachines({ page: 1, pageSize: 100 }, { enabled: open });
  const groupsQuery = useChecksheetGroups({ enabled: open });
  const createMutation = useCreateChecksheetSubmission();
  const [form, setForm] = useState({
    machineCode: "",
    checksheetMode: "",
    inspectionDate: defaultInspectionDate(),
    shift: "1",
    groupCode: ""
  });

  useEffect(() => {
    if (!open) {
      setForm({
        machineCode: "",
        checksheetMode: "",
        inspectionDate: defaultInspectionDate(),
        shift: "1",
        groupCode: ""
      });
    }
  }, [open]);

  const machines = machinesQuery.data?.items ?? [];
  const selectedMachine = machines.find((item) => item.machineCode === form.machineCode);
  const groupOptions = useMemo(
    () => buildGroupOptions(groupsQuery.data, selectedMachine),
    [groupsQuery.data, selectedMachine]
  );

  useEffect(() => {
    const allowedGroupCodes = new Set(groupOptions.map((group) => group.groupCode));
    setForm((current) => ({
      ...current,
      groupCode: allowedGroupCodes.has(current.groupCode) ? current.groupCode : (groupOptions.length === 1 ? groupOptions[0].groupCode : "")
    }));
  }, [groupOptions]);

  const handleMachineChange = (machineCode) => {
    const machine = machines.find((item) => item.machineCode === machineCode);
    setForm((current) => ({
      ...current,
      machineCode,
      checksheetMode: machine?.modes?.[0] ?? "",
      groupCode: machine?.groupCodes?.length === 1 ? machine.groupCodes[0] : ""
    }));
  };

  const handleClose = () => {
    if (createMutation.isPending) return;
    onClose();
  };

  const submitCreate = async (payload) => {
    const response = await createMutation.mutateAsync(payload);
    onClose();
    if (response?.data?.id) {
      navigate(`/checksheets/submissions/${response.data.id}`);
    }
  };

  const handleSubmit = async () => {
    const payload = {
      ...form,
      groupCodes: form.groupCode ? [form.groupCode] : []
    };
    const duplicates = await findExistingMonthlySubmissions(form.machineCode, form.inspectionDate, payload.groupCodes);

    if (duplicates.length > 0) {
      onResolveDuplicate({
        duplicates,
        inspectionDate: form.inspectionDate,
        onCreateNew: () => submitCreate({ ...payload, forceCreateNew: true }),
        onUseExisting: () => {
          onClose();
          navigate(`/checksheets/submissions/${duplicates[0].id}`);
        }
      });
      return;
    }

    await submitCreate(payload);
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Checksheet Transaction</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="info">
            Manual creation stays available for admin only. Operators should use QR scan from the machine location.
          </Alert>
          <TextField
            select
            label="Machine Code"
            value={form.machineCode}
            onChange={(event) => handleMachineChange(event.target.value)}
          >
            {machines.map((machine) => (
              <MenuItem key={machine.machineCode} value={machine.machineCode}>
                {machine.machineCode}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mode"
            value={form.checksheetMode}
            onChange={(event) => setForm((current) => ({ ...current, checksheetMode: event.target.value }))}
            disabled={!selectedMachine}
          >
            {(selectedMachine?.modes ?? []).map((mode) => (
              <MenuItem key={mode} value={mode}>{mode.toUpperCase()}</MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Inspection Date"
              type="date"
              value={form.inspectionDate}
              onChange={(event) => setForm((current) => ({ ...current, inspectionDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              select
              label="Shift"
              value={form.shift}
              onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))}
              fullWidth
            >
              {SHIFT_OPTIONS.map((shift) => (
                <MenuItem key={shift} value={shift}>Shift {shift}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            select
            label="Group"
            value={form.groupCode}
            onChange={(event) => setForm((current) => ({ ...current, groupCode: event.target.value }))}
            disabled={!selectedMachine || groupOptions.length === 0}
          >
            {groupOptions.map((group) => (
              <MenuItem key={group.groupCode} value={group.groupCode}>
                {group.groupCode}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isPending || !form.machineCode || !form.checksheetMode || !form.inspectionDate || !form.shift || !form.groupCode}
        >
          {createMutation.isPending ? "Saving..." : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ScanSubmissionDialog({ open, onClose, navigate, onResolveDuplicate }) {
  const groupsQuery = useChecksheetGroups({ enabled: open });
  const createMutation = useCreateChecksheetSubmission();
  const readerElementIdRef = useRef(`machine-qr-reader-${Math.random().toString(36).slice(2)}`);
  const html5QrCodeRef = useRef(null);
  const fileInputRef = useRef(null);
  const [scanSession, setScanSession] = useState(0);
  const [scanState, setScanState] = useState("idle");
  const [scanErrorMessage, setScanErrorMessage] = useState("");
  const [scannedMachineCode, setScannedMachineCode] = useState("");
  const [form, setForm] = useState({
    checksheetMode: "",
    inspectionDate: defaultInspectionDate(),
    shift: "1",
    groupCode: ""
  });

  const machineQuery = useChecksheetMachine(scannedMachineCode, {
    enabled: open && !!scannedMachineCode,
    retry: false
  });
  const machine = machineQuery.data ?? null;
  const groupOptions = useMemo(
    () => buildGroupOptions(groupsQuery.data, machine),
    [groupsQuery.data, machine]
  );

  useEffect(() => {
    if (!machine) return;
    setForm((current) => ({
      ...current,
      checksheetMode: machine.modes?.includes(current.checksheetMode) ? current.checksheetMode : (machine.modes?.[0] ?? ""),
      groupCode: groupOptions.some((group) => group.groupCode === current.groupCode)
        ? current.groupCode
        : (groupOptions.length === 1 ? groupOptions[0].groupCode : "")
    }));
  }, [groupOptions, machine]);

  useEffect(() => {
    if (!open || scannedMachineCode) {
      return undefined;
    }

    let isCancelled = false;

    const stopScanner = async () => {
      const scanner = html5QrCodeRef.current;
      html5QrCodeRef.current = null;

      if (!scanner) {
        return;
      }

      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch {
        // ignore stop failures during dialog close/reopen
      }

      try {
        await scanner.clear();
      } catch {
        // ignore clear failures
      }
    };

    const startScanner = async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setScanState("unsupported");
        setScanErrorMessage("Camera scanning requires HTTPS or a secure local environment.");
        return;
      }

      try {
        setScanState("starting");
        setScanErrorMessage("");
        const scanner = new Html5Qrcode(readerElementIdRef.current, { verbose: false });
        html5QrCodeRef.current = scanner;

        setScanState("scanning");
        const onScanSuccess = async (decodedText) => {
          const rawValue = decodedText?.trim();
          if (!rawValue) {
            return;
          }

          setScannedMachineCode(rawValue);
          setScanState("detected");
          await stopScanner();
        };

        const scanConfig = {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1
        };

        const startCandidates = [
          { facingMode: "environment" },
          { facingMode: { exact: "environment" } }
        ];

        try {
          const cameras = await Html5Qrcode.getCameras();
          const preferredCamera =
            cameras.find((camera) => /back|rear|environment/i.test(camera.label))?.id ?? cameras[0]?.id;
          if (preferredCamera) {
            startCandidates.push(preferredCamera);
          }
        } catch {
          // keep facingMode-only fallbacks
        }

        let started = false;
        for (const candidate of startCandidates) {
          if (isCancelled || started) {
            break;
          }

          try {
            await scanner.start(candidate, scanConfig, onScanSuccess, () => { });
            started = true;
          } catch {
            // try next startup strategy
          }
        }

        if (!started) {
          throw new Error("Unable to start the camera scanner on this browser or device.");
        }
      } catch (error) {
        setScanState("error");
        setScanErrorMessage(error?.message || "Camera start or QR detection failed.");
        await stopScanner();
      }
    };

    startScanner();

    return () => {
      isCancelled = true;
      stopScanner();
    };
  }, [open, scannedMachineCode, scanSession]);

  const handleClose = () => {
    if (createMutation.isPending) return;
    onClose();
    setScannedMachineCode("");
    setScanState("idle");
    setScanErrorMessage("");
    setForm({
      checksheetMode: "",
      inspectionDate: defaultInspectionDate(),
      shift: "1",
      groupCode: ""
    });
    setScanSession((current) => current + 1);
  };

  const handleRescan = () => {
    setScannedMachineCode("");
    setScanState("idle");
    setScanErrorMessage("");
    setForm({
      checksheetMode: "",
      inspectionDate: defaultInspectionDate(),
      shift: "1",
      groupCode: ""
    });
    setScanSession((current) => current + 1);
  };

  const handleImageSelection = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setScanState("starting");
      setScanErrorMessage("");
      const scanner = new Html5Qrcode(readerElementIdRef.current, { verbose: false });
      const decodedText = await scanner.scanFile(file, true);
      await scanner.clear();
      const rawValue = decodedText?.trim();
      if (!rawValue) {
        throw new Error("No QR code was detected in the selected image.");
      }
      setScannedMachineCode(rawValue);
      setScanState("detected");
    } catch (error) {
      setScanState("error");
      setScanErrorMessage(error?.message || "Image QR scan failed.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async () => {
    const payload = {
      machineCode: scannedMachineCode,
      checksheetMode: form.checksheetMode,
      inspectionDate: form.inspectionDate,
      shift: form.shift,
      groupCodes: form.groupCode ? [form.groupCode] : []
    };
    const duplicates = await findExistingMonthlySubmissions(scannedMachineCode, form.inspectionDate, payload.groupCodes);

    if (duplicates.length > 0) {
      onResolveDuplicate({
        duplicates,
        inspectionDate: form.inspectionDate,
        onCreateNew: async () => {
          const response = await createMutation.mutateAsync({
            ...payload,
            forceCreateNew: true
          });
          handleClose();
          if (response?.data?.id) {
            navigate(`/checksheets/submissions/${response.data.id}`);
          }
        },
        onUseExisting: () => {
          handleClose();
          navigate(`/checksheets/submissions/${duplicates[0].id}`);
        }
      });
      return;
    }

    const response = await createMutation.mutateAsync(payload);
    handleClose();
    if (response?.data?.id) {
      navigate(`/checksheets/submissions/${response.data.id}`);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Scan Machine QR</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          <Typography variant="body2" color="text.secondary">
            Scan the machine QR code from the inspection location. After the machine is detected, continue with mode, inspection date, shift, and group.
          </Typography>

          {!scannedMachineCode && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                bgcolor: "#0f172a",
                color: "#e2e8f0"
              }}
            >
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Camera Scanner
                </Typography>
                <Box
                  sx={{
                    position: "relative",
                    borderRadius: 2,
                    overflow: "hidden",
                    bgcolor: "#020617",
                    minHeight: 280
                  }}
                >
                  <Box
                    id={readerElementIdRef.current}
                    sx={{
                      width: "100%",
                      height: { xs: 280, md: 360 },
                      "& video": {
                        width: "100% !important",
                        height: "100% !important",
                        objectFit: "cover"
                      },
                      "& section": {
                        display: "none"
                      },
                      "& div": {
                        border: "0 !important"
                      }
                    }}
                  />
                  {scanState === "starting" && (
                    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", px: 3 }}>
                      <Typography align="center">Starting camera...</Typography>
                    </Box>
                  )}
                  {scanState === "scanning" && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        pointerEvents: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 220, md: 280 },
                          height: { xs: 220, md: 280 },
                          border: "3px solid rgba(34,197,94,0.9)",
                          borderRadius: 3,
                          boxShadow: "0 0 0 9999px rgba(2,6,23,0.32)"
                        }}
                      />
                    </Box>
                  )}
                  {scanState === "unsupported" && (
                    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 3 }}>
                      <Alert severity="warning">
                        {scanErrorMessage || "Camera scanning is not available in this browser context. Use Scan From Photo instead."}
                      </Alert>
                    </Box>
                  )}
                  {scanState === "error" && (
                    <Box sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", p: 3 }}>
                      <Alert severity="error">
                        {scanErrorMessage || "Camera start or QR detection failed. Check permission, then try scanning again."}
                      </Alert>
                    </Box>
                  )}
                </Box>
                <Typography variant="caption" color="inherit">
                  Point the camera at the machine QR label. The QR value is expected to be the machine code.
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" color="inherit" onClick={() => fileInputRef.current?.click()}>
                    Scan From Photo
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={handleImageSelection}
                  />
                </Stack>
              </Stack>
            </Paper>
          )}

          {scannedMachineCode && (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "flex-start", md: "center" }}>
              <Chip color="success" variant="outlined" label={`Scanned: ${scannedMachineCode}`} />
              <Button startIcon={<RefreshIcon />} onClick={handleRescan}>
                Scan Another Machine
              </Button>
            </Stack>
          )}

          {machineQuery.isLoading && (
            <Alert severity="info">Loading machine information...</Alert>
          )}

          {machineQuery.isError && scannedMachineCode && (
            <Alert severity="error">
              {machineQuery.error?.message || "Machine not found for this QR code."}
            </Alert>
          )}

          {machine && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between">
                  <Box>
                    <Typography variant="h6" fontWeight={700}>{machine.machineCode}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {machine.location} | {machine.lineName} | {machine.processName}
                    </Typography>
                  </Box>
                  <Chip label={machine.checksheetName} variant="outlined" />
                </Stack>

                <TextField
                  select
                  label="Mode"
                  value={form.checksheetMode}
                  onChange={(event) => setForm((current) => ({ ...current, checksheetMode: event.target.value }))}
                >
                  {(machine.modes ?? []).map((mode) => (
                    <MenuItem key={mode} value={mode}>{mode.toUpperCase()}</MenuItem>
                  ))}
                </TextField>

                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    label="Inspection Date"
                    type="date"
                    value={form.inspectionDate}
                    onChange={(event) => setForm((current) => ({ ...current, inspectionDate: event.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Shift"
                    value={form.shift}
                    onChange={(event) => setForm((current) => ({ ...current, shift: event.target.value }))}
                    fullWidth
                  >
                    {SHIFT_OPTIONS.map((shift) => (
                      <MenuItem key={shift} value={shift}>Shift {shift}</MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <TextField
                  select
                  label="Group"
                  value={form.groupCode}
                  onChange={(event) => setForm((current) => ({ ...current, groupCode: event.target.value }))}
                  disabled={groupOptions.length === 0}
                  helperText={
                    groupOptions.length === 0
                      ? "This machine has no assigned groups yet."
                      : groupOptions.length === 1
                        ? "This machine is assigned to one group."
                        : "Select one group from the groups assigned to this machine."
                  }
                >
                  {groupOptions.map((group) => (
                    <MenuItem key={group.groupCode} value={group.groupCode}>
                      {group.groupCode}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Paper>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>Cancel</Button>
        {scannedMachineCode && (
          <Button onClick={handleRescan} disabled={createMutation.isPending}>
            Rescan
          </Button>
        )}
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={createMutation.isPending || !machine || !form.checksheetMode || !form.inspectionDate || !form.shift || !form.groupCode}
        >
          {createMutation.isPending ? "Creating..." : "Continue To Inspection"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default function ChecksheetSubmissionsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canUseManualCreate = authRoles.admin.includes(user?.role);
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [adminDialogOpen, setAdminDialogOpen] = useState(false);
  const [scanToOpenTarget, setScanToOpenTarget] = useState(null);
  const [existingSubmissionState, setExistingSubmissionState] = useState(null);
  const [isResolvingDuplicate, setIsResolvingDuplicate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [filters, setFilters] = useState({
    checksheetMasterId: "",
    lineCode: "",
    location: "",
    status: "",
    month: ""
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useState([{ id: "inspectionDate", desc: true }]);
  const activeSort = sorting[0];
  const { data: checksheetMasters = [] } = useChecksheetMasters();
  const { data: lines = [] } = useChecksheetLines();
  const { data: areas = [] } = useChecksheetAreas();
  const selectedChecksheetMaster = useMemo(
    () => checksheetMasters.find((item) => String(item.id) === String(filters.checksheetMasterId)) ?? null,
    [checksheetMasters, filters.checksheetMasterId]
  );
  const selectedLine = useMemo(
    () => lines.find((line) => line.lineCode === filters.lineCode) ?? null,
    [filters.lineCode, lines]
  );
  const monthRange = useMemo(() => getMonthRange(filters.month), [filters.month]);
  const { data, isLoading, isError, error, isFetching } = useChecksheetSubmissions({
    page,
    pageSize,
    sortBy: activeSort?.id,
    sortDirection: activeSort?.desc === false ? "asc" : "desc",
    checksheetMasterId: filters.checksheetMasterId || undefined,
    lineCode: filters.lineCode || undefined,
    location: filters.location || undefined,
    status: filters.status || undefined,
    inspectionDateFrom: monthRange.from,
    inspectionDateTo: monthRange.to
  });
  const deleteSubmissionMutation = useDeleteChecksheetSubmission();
  const submissions = useMemo(() => data?.items ?? [], [data?.items]);
  const totalCount = data?.totalCount ?? 0;

  useEffect(() => {
    setPage(1);
  }, [filters.checksheetMasterId, filters.lineCode, filters.location, filters.status, filters.month]);

  useEffect(() => {
    setPage(1);
  }, [sorting]);

  const stats = useMemo(
    () => ({
      total: totalCount,
      drafts: submissions.filter((item) => item.status === "draft").length,
      submitted: submissions.filter((item) => item.status === "submitted").length,
      approved: submissions.filter((item) => item.status === "approved").length
    }),
    [submissions, totalCount]
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: "id",
        header: () => <Box sx={{ textAlign: "left" }}>ID</Box>,
        cell: ({ getValue }) => <Box sx={{ textAlign: "left", fontWeight: 600 }}>{getValue()}</Box>,
        size: 80
      },
      {
        id: "machine",
        accessorFn: (row) => row.machineCode ?? "",
        header: "Machine",
        cell: ({ row }) => (
          <>
            <Typography fontWeight={600}>{row.original.machineCode}</Typography>
            <Typography variant="caption" color="text.secondary">
              {row.original.location} | {row.original.lineName}
            </Typography>
          </>
        )
      },
      {
        id: "checksheetName",
        enableSorting: false,
        header: "Checksheet Name",
        cell: ({ row }) => (
          <Stack spacing={0.25} sx={{ maxWidth: 320 }}>
            <Typography
              variant="body2"
              fontWeight={600}
              sx={{ whiteSpace: "normal", wordBreak: "normal", overflowWrap: "break-word" }}
            >
              {[row.original.processCode, row.original.processName].filter(Boolean).join(" - ") || "-"}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ whiteSpace: "normal", wordBreak: "normal", overflowWrap: "break-word" }}
            >
              {row.original.checksheetName || "-"}
            </Typography>
          </Stack>
        )
      },
      {
        accessorKey: "inspectionDate",
        header: "Started Date"
      },
      {
        id: "monthPeriod",
        accessorKey: "inspectionDate",
        header: "Month Period",
        cell: ({ row }) => formatMonthPeriod(row.original.inspectionDate)
      },
      {
        id: "groupCodes",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "center" }}>Group</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "center" }}>
            {row.original.groupCodes.length > 0 ? row.original.groupCodes.join(", ") : "-"}
          </Box>
        )
      },
      {
        accessorKey: "status",
        header: () => <Box sx={{ textAlign: "center", pl: 1 }}>Status</Box>,
        cell: ({ getValue }) => {
          const status = getValue();
          return (
            <Box sx={{ display: "flex", justifyContent: "center" }}>
              <Chip
                label={formatSubmissionStatus(status)}
                size="small"
                color={status === "approved" ? "success" : status === "submitted" ? "warning" : status === "rejected" ? "error" : "default"}
              />
            </Box>
          );
        }
      },
      {
        id: "action",
        enableSorting: false,
        header: () => <Box sx={{ textAlign: "right" }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1 }}>
            {row.original.status === "draft" && (
              <Tooltip title="Delete DRAFT transaction">
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => setDeleteTarget({
                    id: row.original.id,
                    machineCode: row.original.machineCode,
                    inspectionDate: row.original.inspectionDate
                  })}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canUseManualCreate ? (
              <Button endIcon={<LaunchIcon />} onClick={() => navigate(`/checksheets/submissions/${row.original.id}`)}>
                Open
              </Button>
            ) : (
              <Button endIcon={<QrCodeScannerIcon />} onClick={() => setScanToOpenTarget(row.original)}>
                Scan To Open
              </Button>
            )}
          </Box>
        )
      }
    ],
    [canUseManualCreate, navigate]
  );

  const table = useReactTable({
    data: submissions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel()
  });

  const handleResolveDuplicate = (payload) => {
    setExistingSubmissionState(payload);
  };

  const handleDuplicateClose = () => {
    if (isResolvingDuplicate) return;
    setExistingSubmissionState(null);
  };

  const handleUseExistingSubmission = async () => {
    if (!existingSubmissionState?.onUseExisting) return;
    setIsResolvingDuplicate(true);
    try {
      await existingSubmissionState.onUseExisting();
      setExistingSubmissionState(null);
    } finally {
      setIsResolvingDuplicate(false);
    }
  };

  const handleCreateNewSubmission = async () => {
    if (!existingSubmissionState?.onCreateNew) return;
    setIsResolvingDuplicate(true);
    try {
      await existingSubmissionState.onCreateNew();
      setExistingSubmissionState(null);
    } finally {
      setIsResolvingDuplicate(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Checksheet Transactions</Typography>
            <Typography variant="body2" color="text.secondary">
              Operators should scan the machine QR code on location, then continue directly into the inspection entry flow.
            </Typography>
          </Box>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
            <Button variant="contained" startIcon={<QrCodeScannerIcon />} onClick={() => setScanDialogOpen(true)}>
              Scan Machine QR
            </Button>
            {canUseManualCreate && (
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setAdminDialogOpen(true)}>
                New Checksheet
              </Button>
            )}
          </Stack>
        </Stack>

        {!canUseManualCreate && (
          <Alert severity="info">
            Manual checksheet creation is limited to admin. Use the machine QR scan to start inspection from the actual machine location.
          </Alert>
        )}

        <Stack direction="row" spacing={1.5} flexWrap="wrap">
          <Chip label={`${stats.total} Total`} variant="outlined" />
          <Chip label={`${stats.drafts} DRAFT`} color="default" variant="outlined" />
          <Chip label={`${stats.submitted} Submitted`} color="warning" variant="outlined" />
          <Chip label={`${stats.approved} Approved`} color="success" variant="outlined" />
        </Stack>

        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Stack spacing={2}>
              <Typography variant="subtitle2" fontWeight={700}>
                Filters
              </Typography>

              <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="flex-start">
                <Autocomplete
                  options={checksheetMasters}
                  value={selectedChecksheetMaster}
                  onChange={(_, option) =>
                    setFilters((current) => ({
                      ...current,
                      checksheetMasterId: option?.id ?? ""
                    }))
                  }
                  isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                  getOptionLabel={(option) =>
                    option?.id ? `${option.processCode} - ${option.processName} - ${option.checksheetName}` : ""
                  }
                  sx={{ minWidth: 420, maxWidth: 560, flexGrow: 1 }}
                  renderInput={(params) => <TextField {...params} size="small" label="Checksheet Master" placeholder="All" />}
                />

                <Autocomplete
                  options={lines}
                  value={selectedLine}
                  onChange={(_, option) =>
                    setFilters((current) => ({
                      ...current,
                      lineCode: option?.lineCode ?? ""
                    }))
                  }
                  isOptionEqualToValue={(option, value) => option.lineCode === value.lineCode}
                  getOptionLabel={(option) => (option?.lineCode ? `${option.lineCode} - ${option.lineName}` : "")}
                  sx={{ minWidth: 220, maxWidth: 260 }}
                  renderInput={(params) => <TextField {...params} size="small" label="Line" />}
                />

                <TextField
                  select
                  size="small"
                  label="Location"
                  value={filters.location}
                  onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
                  sx={{ minWidth: 180, maxWidth: 220 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {areas.map((area) => (
                    <MenuItem key={area.areaCode} value={area.areaCode}>
                      {area.areaCode} - {area.areaName}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  size="small"
                  label="Status"
                  value={filters.status}
                  onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                  sx={{ minWidth: 180, maxWidth: 220 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {SUBMISSION_STATUS_OPTIONS.map((status) => (
                    <MenuItem key={status} value={status}>
                      {formatSubmissionStatus(status)}
                    </MenuItem>
                  ))}
                </TextField>

                <DatePicker
                  views={["year", "month"]}
                  openTo="month"
                  label="Month Period"
                  value={monthValueToDate(filters.month)}
                  onChange={(value) => {
                    setFilters((current) => ({
                      ...current,
                      month: dateToMonthValue(value)
                    }));
                  }}
                  format="MMMM yyyy"
                  slotProps={{
                    field: { clearable: true },
                    textField: {
                      size: "small",
                      sx: { minWidth: 190, maxWidth: 220 }
                    }
                  }}
                />
              </Stack>
            </Stack>
          </LocalizationProvider>
        </Paper>

        {isLoading ? (
          <Paper variant="outlined" sx={{ p: 4 }}>
            <Typography color="text.secondary">Loading checksheets...</Typography>
          </Paper>
        ) : isError ? (
          <Alert severity="error">{error.message}</Alert>
        ) : (
          <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ opacity: isFetching ? 0.72 : 1, transition: "opacity 0.2s", overflowX: "auto" }}
          >
            <Table>
              <TableHead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === headerGroup.headers.length - 1;
                      const isCenterColumn = ["groupCodes", "status"].includes(header.column.id);

                      return (
                        <TableCell
                          key={header.id}
                          align={isCenterColumn ? "center" : isLastColumn ? "right" : "left"}
                          sx={{
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2
                          }}
                        >
                          {header.isPlaceholder ? null : header.column.getCanSort() ? (
                            <TableSortLabel
                              active={header.column.getIsSorted() !== false}
                              direction={header.column.getIsSorted() || "asc"}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(header.column.columnDef.header, header.getContext())}
                            </TableSortLabel>
                          ) : (
                            flexRender(header.column.columnDef.header, header.getContext())
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} hover>
                    {row.getVisibleCells().map((cell, index) => {
                      const isFirstColumn = index === 0;
                      const isLastColumn = index === row.getVisibleCells().length - 1;
                      const isCenterColumn = ["groupCodes", "status"].includes(cell.column.id);

                      return (
                        <TableCell
                          key={cell.id}
                          align={isCenterColumn ? "center" : isLastColumn ? "right" : "left"}
                          sx={{
                            pl: isFirstColumn ? 3 : 2,
                            pr: isLastColumn ? 3 : 2
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
                {submissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>No checksheet transactions yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={totalCount}
              page={Math.max(0, page - 1)}
              onPageChange={(_, nextPage) => setPage(nextPage + 1)}
              rowsPerPage={pageSize}
              onRowsPerPageChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              rowsPerPageOptions={[10, 20, 50, 100]}
            />
          </TableContainer>
        )}
      </Stack>

      <ScanSubmissionDialog
        open={scanDialogOpen}
        onClose={() => setScanDialogOpen(false)}
        navigate={navigate}
        onResolveDuplicate={handleResolveDuplicate}
      />
      <AdminCreateSubmissionDialog
        open={adminDialogOpen}
        onClose={() => setAdminDialogOpen(false)}
        navigate={navigate}
        onResolveDuplicate={handleResolveDuplicate}
      />
      <ScanToOpenDialog
        open={!!scanToOpenTarget}
        targetSubmission={scanToOpenTarget}
        onClose={() => setScanToOpenTarget(null)}
        onOpenSubmission={(submissionId) => navigate(`/checksheets/submissions/${submissionId}`)}
      />

      <ExistingSubmissionDialog
        open={!!existingSubmissionState}
        pending={isResolvingDuplicate}
        duplicates={existingSubmissionState?.duplicates ?? []}
        inspectionDate={existingSubmissionState?.inspectionDate}
        onClose={handleDuplicateClose}
        onUseExisting={handleUseExistingSubmission}
        onCreateNew={handleCreateNewSubmission}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Checksheet Transaction"
        text={`Delete DRAFT transaction "${deleteTarget?.machineCode || ""}" on ${deleteTarget?.inspectionDate || "-"}?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteSubmissionMutation.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => {
          if (!deleteTarget) return;
          deleteSubmissionMutation.mutate(deleteTarget.id, {
            onSuccess: () => setDeleteTarget(null)
          });
        }}
      />
    </Box>
  );
}
