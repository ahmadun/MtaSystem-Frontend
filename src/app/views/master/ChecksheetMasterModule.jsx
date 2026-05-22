import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { ConfirmationDialog } from "app/components";
import {
  useChecksheetAreas,
  useChecksheetGroups,
  useChecksheetLines,
  useChecksheetMachines,
  useChecksheetMasters,
  useChecksheetMachineCodeOptions,
  useChecksheetTemplates,
  useCreateChecksheetArea,
  useCreateChecksheetGroup,
  useCreateChecksheetLine,
  useCreateChecksheetMachine,
  useCreateChecksheetMaster,
  useDeleteChecksheetArea,
  useDeleteChecksheetGroup,
  useDeleteChecksheetLine,
  useDeleteChecksheetMachine,
  useDeleteChecksheetMaster,
  useUpdateChecksheetArea,
  useUpdateChecksheetGroup,
  useUpdateChecksheetLine,
  useUpdateChecksheetMachine,
  useUpdateChecksheetMaster,
  useCreateChecksheetMachineCodeOption,
  useUpdateChecksheetMachineCodeOption,
  useDeleteChecksheetMachineCodeOption,
  useExportChecksheetMachineLabels,
  useUpsertChecksheetMachineModeTemplate
} from "app/hooks/useChecksheets";

const MODE_OPTIONS = ["daily", "regular"];
const CHECKSHEET_MASTER_ENTRY_FIELDS = [
  { key: "useStandNo", label: "Use Stand No." },
  { key: "useSubAssyNo", label: "Use Sub Assy No." },
  { key: "useMachineCode", label: "Use Machine Code" }
];
const REPAIR_FORM_FORMAT_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "extended", label: "Extended Repair Format" }
];
const CHECKSHEET_MASTER_COLUMN_SX = {
  processCode: { minWidth: 150 },
  processName: { minWidth: 240 },
  checksheetName: { minWidth: 300 },
  entryFields: { minWidth: 260 },
  status: { minWidth: 120 },
  action: { width: 132, minWidth: 132 }
};
const CHECKSHEET_LINE_COLUMN_SX = {
  select: { width: 64, minWidth: 64 },
  machineCode: { minWidth: 180 },
  checksheet: { minWidth: 520 },
  line: { minWidth: 220 },
  multiProductNo: { minWidth: 220 },
  modes: { minWidth: 130 },
  templates: { minWidth: 520 },
  groups: { minWidth: 120 },
  repairForms: { minWidth: 300 },
  status: { minWidth: 120 },
  action: { width: 132, minWidth: 132 }
};

function getColumnSx(columnId, map) {
  return map[columnId] ?? {};
}

function createRepairFormKey() {
  return `repair-form-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createRepairForm(title = "") {
  return {
    formKey: createRepairFormKey(),
    title,
    formatType: "standard",
    sortOrder: 1
  };
}

function normalizeRepairFormsForSubmit(repairForms) {
  const normalized = (repairForms ?? [])
    .map((form, index) => ({
      formKey: form.formKey || createRepairFormKey(),
      title: String(form.title || "").trim(),
      formatType: form.formatType === "extended" ? "extended" : "standard",
      sortOrder: index + 1
    }))
    .filter((form) => form.title);

  return normalized.length > 0 ? normalized : [{ formKey: "repair-form-1", title: "Repair Entry", sortOrder: 1, formatType: "standard" }];
}

function extractMachineCodeSuffix(machineCode, lineCode, processCode) {
  const normalizedMachineCode = String(machineCode ?? "");
  const prefix = `${String(lineCode ?? "")}${String(processCode ?? "")}`;

  if (prefix && normalizedMachineCode.startsWith(prefix)) {
    return normalizedMachineCode.slice(prefix.length);
  }

  return normalizedMachineCode;
}

function PageShell({ title, description, action, children }) {
  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={3}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "flex-start" }} spacing={2}>
          <Box>
            <Typography variant="h5" fontWeight={700}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{description}</Typography>
          </Box>
          {action}
        </Stack>
        <Box>
          {children}
        </Box>
      </Stack>
    </Box>
  );
}

function AreaDialog({ open, mode, initialData, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    areaCode: initialData?.areaCode ?? "",
    areaName: initialData?.areaName ?? "",
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      areaCode: initialData?.areaCode ?? "",
      areaName: initialData?.areaName ?? "",
      isActive: initialData?.isActive ?? true
    });
  }, [initialData]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Area Master" : "Create Area Master"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Area Code" value={form.areaCode} onChange={(event) => setForm((current) => ({ ...current, areaCode: event.target.value }))} disabled={mode === "edit"} />
          <TextField label="Area Name" value={form.areaName} onChange={(event) => setForm((current) => ({ ...current, areaName: event.target.value }))} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit(form)} disabled={isPending || !form.areaCode.trim() || !form.areaName.trim()}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function LineDialog({ open, mode, initialData, areas, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    lineCode: initialData?.lineCode ?? "",
    lineName: initialData?.lineName ?? "",
    areaCode: initialData?.areaCode ?? "",
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      lineCode: initialData?.lineCode ?? "",
      lineName: initialData?.lineName ?? "",
      areaCode: initialData?.areaCode ?? "",
      isActive: initialData?.isActive ?? true
    });
  }, [initialData]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Line Master" : "Create Line Master"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Line Code" value={form.lineCode} onChange={(event) => setForm((current) => ({ ...current, lineCode: event.target.value }))} disabled={mode === "edit"} />
          <TextField label="Line Name" value={form.lineName} onChange={(event) => setForm((current) => ({ ...current, lineName: event.target.value }))} />
          <TextField select label="Location" value={form.areaCode} onChange={(event) => setForm((current) => ({ ...current, areaCode: event.target.value }))}>
            {areas.map((area) => <MenuItem key={area.areaCode} value={area.areaCode}>{area.areaCode} - {area.areaName}</MenuItem>)}
          </TextField>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit(form)} disabled={isPending || !form.lineCode.trim() || !form.lineName.trim() || !form.areaCode}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function GroupDialog({ open, mode, initialData, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    groupCode: initialData?.groupCode ?? "",
    groupName: initialData?.groupName ?? "",
    sortOrder: initialData?.sortOrder ?? 0,
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      groupCode: initialData?.groupCode ?? "",
      groupName: initialData?.groupName ?? "",
      sortOrder: initialData?.sortOrder ?? 0,
      isActive: initialData?.isActive ?? true
    });
  }, [initialData]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Group" : "Create Group"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField label="Group Code" value={form.groupCode} onChange={(event) => setForm((current) => ({ ...current, groupCode: event.target.value }))} disabled={mode === "edit"} />
          <TextField label="Group Name" value={form.groupName} onChange={(event) => setForm((current) => ({ ...current, groupName: event.target.value }))} />
          <TextField label="Sort Order" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit(form)} disabled={isPending || !form.groupCode.trim() || !form.groupName.trim()}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function MachineCodeOptionDialog({ open, mode, initialData, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    machineCode: initialData?.machineCode ?? "",
    description: initialData?.description ?? "",
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      machineCode: initialData?.machineCode ?? "",
      description: initialData?.description ?? "",
      isActive: initialData?.isActive ?? true
    });
  }, [initialData]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Machine Code" : "Create Machine Code"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Machine Code"
            value={form.machineCode}
            onChange={(event) => setForm((current) => ({ ...current, machineCode: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase() }))}
            disabled={mode === "edit"}
          />
          <TextField
            label="Description"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button variant="contained" onClick={() => onSubmit(form)} disabled={isPending || !form.machineCode.trim()}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ChecksheetMasterDialog({ open, mode, initialData, onClose, onSubmit, isPending }) {
  const [form, setForm] = useState({
    processCode: initialData?.processCode ?? "",
    processName: initialData?.processName ?? "",
    checksheetName: initialData?.checksheetName ?? "",
    description: initialData?.description ?? "",
    useStandNo: initialData?.useStandNo ?? false,
    useSubAssyNo: initialData?.useSubAssyNo ?? false,
    useMachineCode: initialData?.useMachineCode ?? false,
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    setForm({
      processCode: initialData?.processCode ?? "",
      processName: initialData?.processName ?? "",
      checksheetName: initialData?.checksheetName ?? "",
      description: initialData?.description ?? "",
      useStandNo: initialData?.useStandNo ?? false,
      useSubAssyNo: initialData?.useSubAssyNo ?? false,
      useMachineCode: initialData?.useMachineCode ?? false,
      isActive: initialData?.isActive ?? true
    });
  }, [initialData]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{mode === "edit" ? "Edit Checksheet Master" : "Create Checksheet Master"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField
            label="Process Code"
            value={form.processCode}
            onChange={(event) => setForm((current) => ({ ...current, processCode: event.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4) }))}
            helperText="Exactly 4 alphanumeric characters."
          />
          <TextField label="Process Name" value={form.processName} onChange={(event) => setForm((current) => ({ ...current, processName: event.target.value }))} />
          <TextField label="Checksheet Name" value={form.checksheetName} onChange={(event) => setForm((current) => ({ ...current, checksheetName: event.target.value }))} />
          <TextField label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} multiline minRows={2} />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Checksheet Line Entry Fields</Typography>
            <FormGroup>
              {CHECKSHEET_MASTER_ENTRY_FIELDS.map((field) => (
                <FormControlLabel
                  key={field.key}
                  control={
                    <Checkbox
                      checked={form[field.key]}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.checked }))}
                    />
                  }
                  label={field.label}
                />
              ))}
            </FormGroup>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSubmit(form)}
          disabled={isPending || form.processCode.trim().length !== 4 || !form.processName.trim() || !form.checksheetName.trim()}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ChecksheetLineDialog({ open, mode, initialData, checksheetMasters, lines, groups, templates, machineCodeOptions, onClose, onSubmit, isPending }) {
  const initialMaster = checksheetMasters.find((item) => item.id === initialData?.checksheetMasterId);
  const initialMachineCodeSuffix = initialData?.machineCodeSuffix
    ?? extractMachineCodeSuffix(initialData?.machineCode, initialData?.lineCode, initialMaster?.processCode);
  const [form, setForm] = useState({
    machineCodeSuffix: initialMachineCodeSuffix ?? "",
    standNo: initialData?.standNo ?? "",
    subAssyNo: initialData?.subAssyNo ?? "",
    machineCodes: initialData?.machineCodes ?? [],
    checksheetMasterId: initialData?.checksheetMasterId ?? "",
    lineCode: initialData?.lineCode ?? "",
    multiProductNo: initialData?.multiProductNo ?? "",
    groupCodes: initialData?.groupCodes ?? [],
    repairForms: initialData?.repairForms?.length ? initialData.repairForms : [createRepairForm("Repair Entry")],
    modes: initialData?.modes ?? [],
    dailyTemplateIds: initialData?.modeTemplates?.filter((item) => item.checksheetMode === "daily" && item.templateId).map((item) => item.templateId) ?? [],
    regularTemplateIds: initialData?.modeTemplates?.filter((item) => item.checksheetMode === "regular" && item.templateId).map((item) => item.templateId) ?? [],
    isActive: initialData?.isActive ?? true
  });

  useEffect(() => {
    const resolvedMaster = checksheetMasters.find((item) => item.id === initialData?.checksheetMasterId);
    setForm({
      machineCodeSuffix: initialData?.machineCodeSuffix
        ?? extractMachineCodeSuffix(initialData?.machineCode, initialData?.lineCode, resolvedMaster?.processCode),
      standNo: initialData?.standNo ?? "",
      subAssyNo: initialData?.subAssyNo ?? "",
      machineCodes: initialData?.machineCodes ?? [],
      checksheetMasterId: initialData?.checksheetMasterId ?? "",
      lineCode: initialData?.lineCode ?? "",
      multiProductNo: initialData?.multiProductNo ?? "",
      groupCodes: initialData?.groupCodes ?? [],
      repairForms: initialData?.repairForms?.length ? initialData.repairForms : [createRepairForm("Repair Entry")],
      modes: initialData?.modes ?? [],
      dailyTemplateIds: initialData?.modeTemplates?.filter((item) => item.checksheetMode === "daily" && item.templateId).map((item) => item.templateId) ?? [],
      regularTemplateIds: initialData?.modeTemplates?.filter((item) => item.checksheetMode === "regular" && item.templateId).map((item) => item.templateId) ?? [],
      isActive: initialData?.isActive ?? true
    });
  }, [checksheetMasters, initialData]);

  const selectedMaster = checksheetMasters.find((item) => item.id === form.checksheetMasterId);
  const selectedLine = lines.find((item) => item.lineCode === form.lineCode) ?? null;
  const resolvedMachineCodeSuffix = form.machineCodeSuffix ?? "";
  const generatedMachineCode = `${form.lineCode || ""}${selectedMaster?.processCode || ""}${resolvedMachineCodeSuffix || ""}`;
  const dailyTemplates = useMemo(
    () => templates.filter((template) => String(template.checksheetMode).toLowerCase() === "daily"),
    [templates]
  );
  const regularTemplates = useMemo(
    () => templates.filter((template) => String(template.checksheetMode).toLowerCase() === "regular"),
    [templates]
  );
  const hasDailyTemplateSelection = form.dailyTemplateIds.length > 0 && form.dailyTemplateIds.every((templateId) => dailyTemplates.some((template) => template.id === templateId));
  const hasRegularTemplateSelection = form.regularTemplateIds.length > 0 && form.regularTemplateIds.every((templateId) => regularTemplates.some((template) => template.id === templateId));
  const isModeTemplateValid = form.modes.every((mode) => {
    if (mode === "daily") return hasDailyTemplateSelection;
    if (mode === "regular") return hasRegularTemplateSelection;
    return false;
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      dailyTemplateIds: current.dailyTemplateIds.filter((templateId) => dailyTemplates.some((template) => template.id === templateId)),
      regularTemplateIds: current.regularTemplateIds.filter((templateId) => regularTemplates.some((template) => template.id === templateId))
    }));
  }, [dailyTemplates, regularTemplates]);

  const normalizedRepairForms = normalizeRepairFormsForSubmit(form.repairForms);
  const toggleMode = (modeValue) => {
    setForm((current) => ({
      ...current,
      modes: current.modes.includes(modeValue)
        ? current.modes.filter((item) => item !== modeValue)
        : [...current.modes, modeValue]
    }));
  };
  const updateRepairForm = (formKey, patch) => {
    setForm((current) => ({
      ...current,
      repairForms: current.repairForms.map((item) => (item.formKey === formKey ? { ...item, ...patch } : item))
    }));
  };
  const addRepairForm = () => {
    setForm((current) => ({
      ...current,
      repairForms: [...current.repairForms, createRepairForm("")]
    }));
  };
  const removeRepairForm = (formKey) => {
    setForm((current) => {
      const nextRepairForms = current.repairForms.filter((item) => item.formKey !== formKey);
      return {
        ...current,
        repairForms: nextRepairForms.length > 0 ? nextRepairForms : [createRepairForm("Repair Entry")]
      };
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{mode === "edit" ? "Edit Checksheet Line" : "Create Checksheet Line"}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <TextField select label="Checksheet Master" value={form.checksheetMasterId} onChange={(event) => setForm((current) => ({ ...current, checksheetMasterId: Number(event.target.value) }))}>
            {checksheetMasters.map((item) => <MenuItem key={item.id} value={item.id}>{item.processCode} - {item.processName} - {item.checksheetName}</MenuItem>)}
          </TextField>
          <Autocomplete
            options={lines}
            value={selectedLine}
            onChange={(_, option) => setForm((current) => ({ ...current, lineCode: option?.lineCode ?? "" }))}
            isOptionEqualToValue={(option, value) => option.lineCode === value.lineCode}
            getOptionLabel={(option) => (option?.lineCode ? `${option.lineCode} - ${option.lineName} (${option.location})` : "")}
            renderInput={(params) => <TextField {...params} label="Line Master" />}
          />
          {selectedMaster?.useStandNo && (
            <TextField
              label="Stand No."
              value={form.standNo}
              onChange={(event) => setForm((current) => ({ ...current, standNo: event.target.value }))}
              helperText="Stored separately for checksheet submission display."
            />
          )}
          {selectedMaster?.useSubAssyNo && (
            <TextField
              label="Sub Assy No."
              value={form.subAssyNo}
              onChange={(event) => setForm((current) => ({ ...current, subAssyNo: event.target.value }))}
              helperText="Stored separately for checksheet submission display."
            />
          )}
          {selectedMaster?.useMachineCode && (
            <TextField
              select
              label="Machine Code"
              value={form.machineCodes}
              onChange={(event) => setForm((current) => ({ ...current, machineCodes: event.target.value }))}
              SelectProps={{ multiple: true, renderValue: (selected) => selected.join(", ") }}
              helperText={machineCodeOptions.length === 0 ? "No active machine code options available." : "Stored separately for checksheet submission display."}
            >
              {machineCodeOptions.map((option) => (
                <MenuItem key={option.machineCode} value={option.machineCode}>
                  <Checkbox checked={form.machineCodes.includes(option.machineCode)} />
                  {option.description ? `${option.machineCode} - ${option.description}` : option.machineCode}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField
            label="Machine Code Suffix"
            value={form.machineCodeSuffix}
            onChange={(event) => setForm((current) => ({ ...current, machineCodeSuffix: event.target.value }))}
            disabled={mode === "edit"}
            helperText={mode === "edit"
              ? "Stored machine code suffix."
              : "Generated machine code format: line code + process code + machine code suffix."}
          />
          <TextField
            label="Generated Machine Code"
            value={generatedMachineCode}
            disabled
            helperText={mode === "edit"
              ? (selectedMaster ? `${selectedMaster.processName} - ${selectedMaster.checksheetName}` : "Stored machine code.")
              : "Preview of the machine_code that will be stored in backend."}
          />
          <TextField
            label="Multi Product No."
            value={form.multiProductNo}
            onChange={(event) => setForm((current) => ({ ...current, multiProductNo: event.target.value }))}
            helperText="Example: 82184-V2130 A00002"
          />
          <TextField
            select
            label="Groups"
            value={form.groupCodes}
            onChange={(event) => setForm((current) => ({ ...current, groupCodes: event.target.value }))}
            SelectProps={{ multiple: true, renderValue: (selected) => selected.join(", ") }}
          >
            {groups.map((group) => <MenuItem key={group.groupCode} value={group.groupCode}>{group.groupCode} - {group.groupName}</MenuItem>)}
          </TextField>
          <Stack spacing={1.5}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="subtitle2">Repair Entry Forms</Typography>
                <Typography variant="caption" color="text.secondary">
                  Define the titled repair sections that will appear in the checksheet submission detail page.
                </Typography>
              </Box>
              <Button variant="outlined" size="small" onClick={addRepairForm}>
                Add Repair Form
              </Button>
            </Stack>
            {form.repairForms.map((repairForm, index) => (
              <Paper key={repairForm.formKey} variant="outlined" sx={{ p: 2 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
                  <TextField
                    label={`Repair Form ${index + 1} Title`}
                    value={repairForm.title}
                    onChange={(event) => updateRepairForm(repairForm.formKey, { title: event.target.value })}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Format"
                    value={repairForm.formatType === "extended" ? "extended" : "standard"}
                    onChange={(event) => updateRepairForm(repairForm.formKey, { formatType: event.target.value })}
                    sx={{ minWidth: 220 }}
                  >
                    {REPAIR_FORM_FORMAT_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <IconButton
                    color="error"
                    onClick={() => removeRepairForm(repairForm.formKey)}
                    disabled={form.repairForms.length === 1}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </Paper>
            ))}
          </Stack>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Modes</Typography>
            <FormGroup row sx={{ gap: 1 }}>
              {MODE_OPTIONS.map((modeOption) => (
                <FormControlLabel
                  key={modeOption}
                  control={
                    <Checkbox
                      checked={form.modes.includes(modeOption)}
                      onChange={() => toggleMode(modeOption)}
                    />
                  }
                  label={modeOption.toLocaleUpperCase()}
                  sx={{
                    m: 0,
                    px: 1.25,
                    py: 0.5,
                    border: 1,
                    borderColor: form.modes.includes(modeOption) ? "primary.main" : "divider",
                    borderRadius: 2,
                    bgcolor: form.modes.includes(modeOption) ? "primary.50" : "transparent"
                  }}
                />
              ))}
            </FormGroup>
          </Box>
          {form.modes.includes("daily") && (
            <TextField
              select
              label="Daily Templates"
              value={form.dailyTemplateIds}
              onChange={(event) => setForm((current) => ({ ...current, dailyTemplateIds: event.target.value.map(Number) }))}
              SelectProps={{ multiple: true, renderValue: (selected) => dailyTemplates.filter((template) => selected.includes(template.id)).map((template) => template.name).join(", ") }}
              helperText={dailyTemplates.length === 0 ? "No active daily templates available." : undefined}
            >
              {dailyTemplates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  <Checkbox checked={form.dailyTemplateIds.includes(template.id)} />
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          {form.modes.includes("regular") && (
            <TextField
              select
              label="Regular Templates"
              value={form.regularTemplateIds}
              onChange={(event) => setForm((current) => ({ ...current, regularTemplateIds: event.target.value.map(Number) }))}
              SelectProps={{ multiple: true, renderValue: (selected) => regularTemplates.filter((template) => selected.includes(template.id)).map((template) => template.name).join(", ") }}
              helperText={regularTemplates.length === 0 ? "No active regular templates available." : undefined}
            >
              {regularTemplates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  <Checkbox checked={form.regularTemplateIds.includes(template.id)} />
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
          )}
          <Stack direction="row" spacing={1} alignItems="center">
            <Switch checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <Typography>{form.isActive ? "Active" : "Inactive"}</Typography>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isPending}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => onSubmit({ ...form, machineCodeSuffix: resolvedMachineCodeSuffix, repairForms: normalizedRepairForms })}
          disabled={isPending || !resolvedMachineCodeSuffix.trim() || !form.checksheetMasterId || !form.lineCode || !form.multiProductNo.trim() || form.groupCodes.length === 0 || normalizedRepairForms.length === 0 || form.modes.length === 0 || !isModeTemplateValid}
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function ChecksheetAreasPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: areas = [], isLoading, isError, error } = useChecksheetAreas();
  const createArea = useCreateChecksheetArea();
  const updateArea = useUpdateChecksheetArea(dialogState.data?.areaCode);
  const deleteArea = useDeleteChecksheetArea();

  const columns = useMemo(
    () => [
      { accessorKey: "areaCode", header: "Code" },
      { accessorKey: "areaName", header: "Name" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive")
      },
      {
        id: "action",
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1, pr: 1.5 }}>
            <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: row.original })}><EditOutlinedIcon /></IconButton>
            <IconButton color="error" onClick={() => setDeleteTarget({ id: row.original.areaCode, name: row.original.areaCode })}><DeleteOutlineIcon /></IconButton>
          </Box>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: areas,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <PageShell
      title="Area Master"
      description="Manage location master used by line master selection."
      action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>Add Area</Button>}
    >
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 980 }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirstColumn = index === 0;
                  const isLastColumn = index === headerGroup.headers.length - 1;

                  return (
                    <TableCell
                      key={header.id}
                      align={isLastColumn ? "right" : "left"}
                      sx={{
                        ...getColumnSx(header.column.id, CHECKSHEET_MASTER_COLUMN_SX),
                        py: 1.5,
                        pl: isFirstColumn ? 3 : 2.5,
                        pr: isLastColumn ? 3 : 2.5,
                        whiteSpace: "nowrap",
                        fontWeight: 700
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>Loading areas...</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    const isLastColumn = index === row.getVisibleCells().length - 1;

                    return (
                      <TableCell
                        key={cell.id}
                        align={isLastColumn ? "right" : "left"}
                        sx={{
                          ...getColumnSx(cell.column.id, CHECKSHEET_MASTER_COLUMN_SX),
                          py: 1.5,
                          pl: isFirstColumn ? 3 : 2.5,
                          pr: isLastColumn ? 3 : 2.5,
                          verticalAlign: "top"
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>No areas found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <AreaDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        isPending={createArea.isPending || updateArea.isPending}
        onSubmit={(payload) => {
          const action = dialogState.mode === "edit"
            ? updateArea.mutateAsync({ areaName: payload.areaName, isActive: payload.isActive })
            : createArea.mutateAsync(payload);
          action.then(() => setDialogState({ open: false, mode: "create", data: null }));
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Area"
        text={`Delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteArea.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteArea.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </PageShell>
  );
}

export function ChecksheetLineMastersPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: lines = [], isLoading, isError, error } = useChecksheetLines();
  const { data: areas = [] } = useChecksheetAreas();
  const createLine = useCreateChecksheetLine();
  const updateLine = useUpdateChecksheetLine(dialogState.data?.lineCode);
  const deleteLine = useDeleteChecksheetLine();

  const columns = useMemo(
    () => [
      { accessorKey: "lineCode", header: "Code" },
      { accessorKey: "lineName", header: "Name" },
      { accessorKey: "location", header: "Location" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive")
      },
      {
        id: "action",
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1, pr: 1.5 }}>
            <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: row.original })}><EditOutlinedIcon /></IconButton>
            <IconButton color="error" onClick={() => setDeleteTarget({ id: row.original.lineCode, name: row.original.lineCode })}><DeleteOutlineIcon /></IconButton>
          </Box>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: lines,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <PageShell
      title="Line Master"
      description="Set up line code, line name, and location master selection."
      action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>Add Line</Button>}
    >
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 2160 }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirstColumn = index === 0;
                  const isLastColumn = index === headerGroup.headers.length - 1;

                  return (
                    <TableCell
                      key={header.id}
                      align={isLastColumn ? "right" : "left"}
                      sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>Loading lines...</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    const isLastColumn = index === row.getVisibleCells().length - 1;

                    return (
                      <TableCell
                        key={cell.id}
                        align={isLastColumn ? "right" : "left"}
                        sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>No lines found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <LineDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        areas={areas.filter((item) => item.isActive)}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        isPending={createLine.isPending || updateLine.isPending}
        onSubmit={(payload) => {
          const action = dialogState.mode === "edit"
            ? updateLine.mutateAsync({ lineName: payload.lineName, areaCode: payload.areaCode, isActive: payload.isActive })
            : createLine.mutateAsync(payload);
          action.then(() => setDialogState({ open: false, mode: "create", data: null }));
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Line"
        text={`Delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteLine.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteLine.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </PageShell>
  );
}

export function ChecksheetGroupsPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: groups = [], isLoading, isError, error } = useChecksheetGroups();
  const createGroup = useCreateChecksheetGroup();
  const updateGroup = useUpdateChecksheetGroup(dialogState.data?.groupCode);
  const deleteGroup = useDeleteChecksheetGroup();

  const columns = useMemo(
    () => [
      { accessorKey: "groupCode", header: "Code" },
      { accessorKey: "groupName", header: "Name" },
      { accessorKey: "sortOrder", header: "Sort" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive")
      },
      {
        id: "action",
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1, pr: 1.5 }}>
            <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: row.original })}><EditOutlinedIcon /></IconButton>
            <IconButton color="error" onClick={() => setDeleteTarget({ id: row.original.groupCode, name: row.original.groupCode })}><DeleteOutlineIcon /></IconButton>
          </Box>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: groups,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <PageShell
      title="Group Master"
      description="Manage group options used inside each checksheet master mapping."
      action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>Add Group</Button>}
    >
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirstColumn = index === 0;
                  const isLastColumn = index === headerGroup.headers.length - 1;

                  return (
                    <TableCell
                      key={header.id}
                      align={isLastColumn ? "right" : "left"}
                      sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>Loading groups...</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    const isLastColumn = index === row.getVisibleCells().length - 1;

                    return (
                      <TableCell
                        key={cell.id}
                        align={isLastColumn ? "right" : "left"}
                        sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>No groups found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <GroupDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        isPending={createGroup.isPending || updateGroup.isPending}
        onSubmit={(payload) => {
          const action = dialogState.mode === "edit"
            ? updateGroup.mutateAsync({ groupName: payload.groupName, sortOrder: payload.sortOrder, isActive: payload.isActive })
            : createGroup.mutateAsync(payload);
          action.then(() => setDialogState({ open: false, mode: "create", data: null }));
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Group"
        text={`Delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteGroup.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteGroup.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </PageShell>
  );
}

export function ChecksheetMachineCodeOptionsPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: machineCodeOptions = [], isLoading, isError, error } = useChecksheetMachineCodeOptions();
  const createMachineCodeOption = useCreateChecksheetMachineCodeOption();
  const updateMachineCodeOption = useUpdateChecksheetMachineCodeOption(dialogState.data?.machineCode);
  const deleteMachineCodeOption = useDeleteChecksheetMachineCodeOption();

  const columns = useMemo(
    () => [
      { accessorKey: "machineCode", header: "Machine Code" },
      { accessorKey: "description", header: "Description", cell: ({ row }) => row.original.description || "-" },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive")
      },
      {
        id: "action",
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1, pr: 1.5 }}>
            <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: row.original })}><EditOutlinedIcon /></IconButton>
            <IconButton color="error" onClick={() => setDeleteTarget({ id: row.original.machineCode, name: row.original.machineCode })}><DeleteOutlineIcon /></IconButton>
          </Box>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: machineCodeOptions,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <PageShell
      title="Machine Code Master"
      description="Manage machine code options used by Checksheet Line entry."
      action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>Add Machine Code</Button>}
    >
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirstColumn = index === 0;
                  const isLastColumn = index === headerGroup.headers.length - 1;

                  return (
                    <TableCell key={header.id} align={isLastColumn ? "right" : "left"} sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>Loading machine codes...</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    const isLastColumn = index === row.getVisibleCells().length - 1;

                    return (
                      <TableCell key={cell.id} align={isLastColumn ? "right" : "left"} sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2 }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>No machine codes found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <MachineCodeOptionDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        isPending={createMachineCodeOption.isPending || updateMachineCodeOption.isPending}
        onSubmit={(payload) => {
          const action = dialogState.mode === "edit"
            ? updateMachineCodeOption.mutateAsync({ description: payload.description, isActive: payload.isActive })
            : createMachineCodeOption.mutateAsync(payload);
          action.then(() => setDialogState({ open: false, mode: "create", data: null }));
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Machine Code"
        text={`Delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteMachineCodeOption.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteMachineCodeOption.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </PageShell>
  );
}

export function ChecksheetMastersPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { data: checksheetMasters = [], isLoading, isError, error } = useChecksheetMasters();
  const createChecksheetMaster = useCreateChecksheetMaster();
  const updateChecksheetMaster = useUpdateChecksheetMaster(dialogState.data?.id);
  const deleteChecksheetMaster = useDeleteChecksheetMaster();

  const columns = useMemo(
    () => [
      { accessorKey: "processCode", header: "Process Code" },
      { accessorKey: "processName", header: "Process" },
      { accessorKey: "checksheetName", header: "Checksheet" },
      {
        id: "entryFields",
        header: "Line Entry Fields",
        cell: ({ row }) => {
          const enabledFields = CHECKSHEET_MASTER_ENTRY_FIELDS.filter((field) => row.original[field.key]);

          return enabledFields.length > 0 ? (
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              {enabledFields.map((field) => <Chip key={field.key} size="small" label={field.label.replace("Use ", "")} />)}
            </Stack>
          ) : "-";
        }
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive")
      },
      {
        id: "action",
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1, pr: 1.5 }}>
            <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: row.original })}><EditOutlinedIcon /></IconButton>
            <IconButton color="error" onClick={() => setDeleteTarget({ id: row.original.id, name: row.original.checksheetName })}><DeleteOutlineIcon /></IconButton>
          </Box>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data: checksheetMasters,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <PageShell
      title="Checksheet Master"
      description="Manage checksheet master. Line and group mapping are defined at checksheet line level."
      action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>Add Checksheet Master</Button>}
    >
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 1180 }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirstColumn = index === 0;
                  const isLastColumn = index === headerGroup.headers.length - 1;

                  return (
                    <TableCell
                      key={header.id}
                      align={isLastColumn ? "right" : "left"}
                      sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2, ...getColumnSx(header.column.id, CHECKSHEET_MASTER_COLUMN_SX) }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>Loading checksheet masters...</TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    const isLastColumn = index === row.getVisibleCells().length - 1;

                    return (
                      <TableCell
                        key={cell.id}
                        align={isLastColumn ? "right" : "left"}
                        sx={{ pl: isFirstColumn ? 3 : 2, pr: isLastColumn ? 3 : 2, ...getColumnSx(cell.column.id, CHECKSHEET_MASTER_COLUMN_SX) }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6, px: 3 }}>No checksheet masters found.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <ChecksheetMasterDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        isPending={createChecksheetMaster.isPending || updateChecksheetMaster.isPending}
        onSubmit={(payload) => {
          const action = dialogState.mode === "edit" ? updateChecksheetMaster.mutateAsync(payload) : createChecksheetMaster.mutateAsync(payload);
          action.then(() => setDialogState({ open: false, mode: "create", data: null }));
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Checksheet Master"
        text={`Delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteChecksheetMaster.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteChecksheetMaster.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </PageShell>
  );
}

export function ChecksheetLinesPage() {
  const [dialogState, setDialogState] = useState({ open: false, mode: "create", data: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedMachineCodes, setSelectedMachineCodes] = useState([]);
  const [filters, setFilters] = useState({
    checksheetMasterId: "",
    lineCode: "",
    location: ""
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const { data: checksheetMasters = [] } = useChecksheetMasters();
  const { data: lines = [] } = useChecksheetLines();
  const { data: areas = [] } = useChecksheetAreas();
  const { data: groups = [] } = useChecksheetGroups();
  const { data: machineCodeOptions = [] } = useChecksheetMachineCodeOptions();
  const { data: machinesPage, isLoading, isError, error } = useChecksheetMachines({
    page: page + 1,
    pageSize: rowsPerPage,
    checksheetMasterId: filters.checksheetMasterId || undefined,
    lineCode: filters.lineCode || undefined,
    location: filters.location || undefined
  });
  const { data: templatesPage } = useChecksheetTemplates({ page: 1, pageSize: 200, isActive: true });
  const templates = useMemo(() => templatesPage?.items ?? [], [templatesPage?.items]);
  const machines = useMemo(() => machinesPage?.items ?? [], [machinesPage?.items]);
  const selectedChecksheetMaster = useMemo(
    () => checksheetMasters.find((item) => String(item.id) === String(filters.checksheetMasterId)) ?? null,
    [checksheetMasters, filters.checksheetMasterId]
  );
  const selectedLine = useMemo(
    () => lines.find((line) => line.lineCode === filters.lineCode) ?? null,
    [filters.lineCode, lines]
  );
  const totalCount = machinesPage?.totalCount ?? 0;
  const createMachine = useCreateChecksheetMachine();
  const updateMachine = useUpdateChecksheetMachine(dialogState.data?.machineCode);
  const upsertModeTemplate = useUpsertChecksheetMachineModeTemplate();
  const deleteMachine = useDeleteChecksheetMachine();
  const exportMachineLabels = useExportChecksheetMachineLabels();

  useEffect(() => {
    setPage(0);
  }, [filters.checksheetMasterId, filters.lineCode, filters.location]);

  const currentPageMachineCodes = useMemo(
    () => machines.map((machine) => machine.machineCode),
    [machines]
  );
  const selectedMachineCodeSet = useMemo(
    () => new Set(selectedMachineCodes),
    [selectedMachineCodes]
  );
  const allCurrentPageSelected =
    currentPageMachineCodes.length > 0 && currentPageMachineCodes.every((machineCode) => selectedMachineCodeSet.has(machineCode));
  const someCurrentPageSelected =
    currentPageMachineCodes.some((machineCode) => selectedMachineCodeSet.has(machineCode)) && !allCurrentPageSelected;

  const toggleMachineSelection = (machineCode) => {
    setSelectedMachineCodes((current) =>
      current.includes(machineCode)
        ? current.filter((value) => value !== machineCode)
        : [...current, machineCode]
    );
  };

  const toggleCurrentPageSelection = () => {
    setSelectedMachineCodes((current) => {
      const currentSet = new Set(current);
      if (allCurrentPageSelected) {
        currentPageMachineCodes.forEach((machineCode) => currentSet.delete(machineCode));
      } else {
        currentPageMachineCodes.forEach((machineCode) => currentSet.add(machineCode));
      }
      return Array.from(currentSet);
    });
  };

  const columns = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            size="small"
            checked={allCurrentPageSelected}
            indeterminate={someCurrentPageSelected}
            onChange={toggleCurrentPageSelection}
            inputProps={{ "aria-label": "select all machines on current page" }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="small"
            checked={selectedMachineCodeSet.has(row.original.machineCode)}
            onChange={() => toggleMachineSelection(row.original.machineCode)}
            inputProps={{ "aria-label": `select ${row.original.machineCode}` }}
          />
        )
      },
      {
        accessorKey: "machineCode",
        header: "Machine"
      },
      {
        id: "checksheet",
        header: "Checksheet",
        cell: ({ row }) => `${row.original.processCode} - ${row.original.processName} - ${row.original.checksheetName}`
      },
      {
        id: "line",
        header: "Line",
        cell: ({ row }) => `${row.original.lineName} (${row.original.location})`
      },
      {
        accessorKey: "multiProductNo",
        header: "Multi Product No.",
        cell: ({ row }) => row.original.multiProductNo || "-"
      },
      {
        id: "modes",
        header: "Modes",
        cell: ({ row }) => row.original.modes?.join(", ").toUpperCase() || "-"
      },
      {
        id: "templates",
        header: "Templates",
        cell: ({ row }) => {
          const modeTemplates = row.original.modeTemplates ?? [];

          if (modeTemplates.length === 0) {
            return "-";
          }

          return (
            <Stack spacing={0.75} sx={{ minWidth: 480 }}>
              {modeTemplates.map((item) => {
                const mode = String(item.checksheetMode || "").toUpperCase();
                const isDaily = mode === "DAILY";

                return (
                  <Stack
                    key={`${row.original.machineCode}-${mode}-${item.templateId || item.templateName}`}
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    sx={{ minWidth: 0 }}
                  >
                    <Chip
                      size="small"
                      label={mode || "-"}
                      color={isDaily ? "primary" : "secondary"}
                      variant={isDaily ? "filled" : "outlined"}
                      sx={{ minWidth: 78, fontWeight: 700 }}
                    />
                    <Typography
                      variant="body2"
                      sx={{
                        minWidth: 0,
                        whiteSpace: "normal",
                        overflowWrap: "normal",
                        wordBreak: "normal"
                      }}
                    >
                      {item.templateName || "-"}
                    </Typography>
                  </Stack>
                );
              })}
            </Stack>
          );
        }
      },
      {
        id: "groups",
        header: () => <Box sx={{ textAlign: "center" }}>Groups</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "center" }}>
            {row.original.groupCodes?.join(", ") || "-"}
          </Box>
        )
      },
      {
        id: "repairForms",
        header: "Repair Forms",
        cell: ({ row }) => (row.original.repairForms ?? []).map((item) => `${item.sortOrder}. ${item.title}`).join(" | ") || "-"
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (row.original.isActive ? "Active" : "Inactive")
      },
      {
        id: "action",
        header: () => <Box sx={{ textAlign: "right", pr: 1.5 }}>Action</Box>,
        cell: ({ row }) => (
          <Box sx={{ textAlign: "right", display: "flex", justifyContent: "flex-end", gap: 1, pr: 1.5 }}>
            <IconButton onClick={() => setDialogState({ open: true, mode: "edit", data: row.original })}>
              <EditOutlinedIcon />
            </IconButton>
            <IconButton color="error" onClick={() => setDeleteTarget({ id: row.original.machineCode, name: row.original.machineCode })}>
              <DeleteOutlineIcon />
            </IconButton>
          </Box>
        )
      }
    ],
    [allCurrentPageSelected, currentPageMachineCodes, selectedMachineCodeSet, someCurrentPageSelected]
  );

  const table = useReactTable({
    data: machines,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  if (isError) {
    return <Box sx={{ p: 3 }}><Alert severity="error">{error.message}</Alert></Box>;
  }

  return (
    <PageShell
      title="Checksheet Line"
      description="Map machine to checksheet master, line master, and group, then assign mode and template."
      action={(
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }}>
          <Button
            variant="outlined"
            startIcon={<DownloadOutlinedIcon />}
            disabled={selectedMachineCodes.length === 0 || exportMachineLabels.isPending}
            onClick={() => exportMachineLabels.mutate({ machineCodes: selectedMachineCodes })}
          >
            {exportMachineLabels.isPending ? "Exporting..." : `Export Selected Labels${selectedMachineCodes.length ? ` (${selectedMachineCodes.length})` : ""}`}
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogState({ open: true, mode: "create", data: null })}>Add Checksheet Line</Button>
        </Stack>
      )}
    >
      <Paper variant="outlined" sx={{ p: 2.5, mb: 3 }}>
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
          </Stack>
        </Stack>
      </Paper>

      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={1}
        sx={{ mb: 2 }}
      >
        {selectedMachineCodes.length > 0 && (
          <Button size="small" onClick={() => setSelectedMachineCodes([])}>
            Clear Selection
          </Button>
        )}
      </Stack>

      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
        <Table sx={{ minWidth: 2560 }}>
          <TableHead>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header, index) => {
                  const isFirstColumn = index === 0;
                  const isLastColumn = index === headerGroup.headers.length - 1;
                  const isCenterColumn = header.column.id === "groups";

                  return (
                    <TableCell
                      key={header.id}
                      align={isCenterColumn ? "center" : isLastColumn ? "right" : "left"}
                      sx={{
                        ...getColumnSx(header.column.id, CHECKSHEET_LINE_COLUMN_SX),
                        py: 1.5,
                        pl: isFirstColumn ? 3 : 2.5,
                        pr: isLastColumn ? 3 : 2.5,
                        whiteSpace: "nowrap",
                        fontWeight: 700
                      }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  Loading checksheet lines...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} hover>
                  {row.getVisibleCells().map((cell, index) => {
                    const isFirstColumn = index === 0;
                    const isLastColumn = index === row.getVisibleCells().length - 1;
                    const isCenterColumn = cell.column.id === "groups";

                    return (
                      <TableCell
                        key={cell.id}
                        align={isCenterColumn ? "center" : isLastColumn ? "right" : "left"}
                        sx={{
                          ...getColumnSx(cell.column.id, CHECKSHEET_LINE_COLUMN_SX),
                          py: 1.5,
                          pl: isFirstColumn ? 3 : 2.5,
                          pr: isLastColumn ? 3 : 2.5,
                          whiteSpace: "normal",
                          overflowWrap: "normal",
                          wordBreak: "normal",
                          verticalAlign: "top"
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 6 }}>
                  No checksheet lines found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 20, 50, 100]}
        />
      </TableContainer>

      <ChecksheetLineDialog
        open={dialogState.open}
        mode={dialogState.mode}
        initialData={dialogState.data}
        checksheetMasters={checksheetMasters.filter((item) => item.isActive)}
        lines={lines.filter((item) => item.isActive)}
        groups={groups.filter((item) => item.isActive)}
        templates={templates}
        machineCodeOptions={machineCodeOptions.filter((item) => item.isActive)}
        onClose={() => setDialogState({ open: false, mode: "create", data: null })}
        isPending={createMachine.isPending || updateMachine.isPending || upsertModeTemplate.isPending}
        onSubmit={async (payload) => {
          const basePayload = {
            machineCodeSuffix: payload.machineCodeSuffix,
            standNo: payload.standNo,
            subAssyNo: payload.subAssyNo,
            machineCodes: payload.machineCodes,
            checksheetMasterId: payload.checksheetMasterId,
            lineCode: payload.lineCode,
            multiProductNo: payload.multiProductNo,
            groupCodes: payload.groupCodes,
            repairForms: payload.repairForms,
            modes: payload.modes,
            isActive: payload.isActive
          };

          let resolvedMachineCode = dialogState.mode === "edit" ? dialogState.data.machineCode : "";
          if (dialogState.mode === "edit") {
            await updateMachine.mutateAsync(basePayload);
          } else {
            const createdResponse = await createMachine.mutateAsync(basePayload);
            resolvedMachineCode = createdResponse?.data?.machineCode ?? "";
          }

          const machineCode = dialogState.mode === "edit" ? dialogState.data.machineCode : resolvedMachineCode;
          if (payload.modes.includes("daily") && payload.dailyTemplateIds?.length) {
            await upsertModeTemplate.mutateAsync({ machineCode, checksheetMode: "daily", templateIds: payload.dailyTemplateIds });
          }
          if (payload.modes.includes("regular") && payload.regularTemplateIds?.length) {
            await upsertModeTemplate.mutateAsync({ machineCode, checksheetMode: "regular", templateIds: payload.regularTemplateIds });
          }

          setDialogState({ open: false, mode: "create", data: null });
        }}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Checksheet Line"
        text={`Delete "${deleteTarget?.name}"?`}
        confirmText="Delete"
        confirmColor="error"
        isLoading={deleteMachine.isPending}
        onConfirmDialogClose={() => setDeleteTarget(null)}
        onYesClick={() => deleteMachine.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}
      />
    </PageShell>
  );
}
