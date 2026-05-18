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
        path: "/approvals/templates"
      }
    ]
  },
  {
    name: "Master Management",
    icon: "group",
    children: [
      {
        name: "User",
        iconText: "AP",
        path: "/users"
      },
      {
        name: "Form Templates",
        iconText: "FT",
        path: "/master/checksheet-templates"
      },
      {
        name: "Checksheet Approver",
        iconText: "CA",
        path: "/master/checksheet-step-approvers"
      },
      {
        name: "Area Master",
        iconText: "AM",
        path: "/master/checksheet-areas"
      },
      {
        name: "Line Master",
        iconText: "LM",
        path: "/master/checksheet-line-masters"
      },
      {
        name: "Group Master",
        iconText: "GM",
        path: "/master/checksheet-groups"
      },
      {
        name: "Checksheet Masters",
        iconText: "CM",
        path: "/master/checksheet-masters"
      },
      {
        name: "Checksheet Lines",
        iconText: "CL",
        path: "/master/checksheet-lines"
      },
      {
        name: "Repairman Checker",
        iconText: "RC",
        path: "/master/repairman-checkers"
      }
    ]
  }
];

export default navigations;
