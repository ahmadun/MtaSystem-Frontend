import { authRoles } from "app/auth/authRoles";

const navigations = [
  {
    name: "Dashboard",
    icon: "dashboard",
    path: "/dashboard"
  },
  {
    name: "CheckSheets",
    icon: "fact_check",
    children: [
      {
        name: "Transactions",
        iconText: "CT",
        path: "/checksheets/submissions"
      },
      {
        name: "Repair History",
        iconText: "RH",
        path: "/checksheets/repairs"
      },
      {
        name: "Monthly Results",
        iconText: "MR",
        path: "/checksheets/monthly-results"
      }
    ]
  },
  {
    name: "Approvals",
    icon: "verified",
    children: [
      {
        name: "Pending My Action",
        iconText: "PA",
        path: "/approvals/pending"
      },

      {
        name: "Pending Repairs",
        iconText: "PR",
        path: "/approvals/repairs"
      },
      {
        name: "Approval Templates",
        iconText: "AT",
        path: "/approvals/templates",
        auth: authRoles.admin
      }
    ]
  },
  {
    name: "Master Management",
    icon: "group",
    auth: authRoles.admin,
    children: [
      {
        name: "User",
        iconText: "AP",
        path: "/users",
        auth: authRoles.admin
      },
      {
        name: "Form Templates",
        iconText: "FT",
        path: "/master/checksheet-templates",
        auth: authRoles.sa
      },
      {
        name: "Checksheet Approver",
        iconText: "CA",
        path: "/master/checksheet-step-approvers",
        auth: authRoles.admin
      },
      {
        name: "Area Master",
        iconText: "AM",
        path: "/master/checksheet-areas",
        auth: authRoles.sa
      },
      {
        name: "Line Master",
        iconText: "LM",
        path: "/master/checksheet-line-masters",
        auth: authRoles.admin
      },
      {
        name: "Group Master",
        iconText: "GM",
        path: "/master/checksheet-groups",
        auth: authRoles.sa
      },
      {
        name: "Machine Code",
        iconText: "MC",
        path: "/master/checksheet-machine-codes",
        auth: authRoles.admin
      },
      {
        name: "Calendar Management",
        iconText: "CM",
        path: "/master/calendar",
        auth: authRoles.admin
      },
      {
        name: "Checksheet Masters",
        iconText: "CS",
        path: "/master/checksheet-masters",
        auth: authRoles.admin
      },
      {
        name: "Checksheet Lines",
        iconText: "CL",
        path: "/master/checksheet-lines",
        auth: authRoles.admin
      },
      {
        name: "Repairman Checker",
        iconText: "RC",
        path: "/master/repairman-checkers",
        auth: authRoles.admin
      }
    ]
  }
];

export default navigations;
