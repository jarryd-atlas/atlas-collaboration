/**
 * Function definitions for the Deepgram Voice Agent.
 * These are called by Claude during the interview to save structured data.
 * Uses client-side function calling — the browser handles the save.
 */

export const INTERVIEW_FUNCTIONS = [
  {
    name: "save_site_contact",
    description: "Save a site contact's information. Call this for each person present at the interview.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Full name of the contact" },
        title: { type: "string", description: "Job title or role at the facility" },
        email: { type: "string", description: "Email address" },
        phone: { type: "string", description: "Phone number" },
        is_primary: { type: "boolean", description: "Whether this is the primary site contact" },
      },
      required: ["name"],
    },
  },
  {
    name: "save_equipment",
    description: "Save a piece of refrigeration equipment. Call ONCE per equipment item. Include all known specs.",
    parameters: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["compressor", "condenser", "evaporator", "vessel", "vfd", "pump", "controls", "other"],
          description: "Equipment category",
        },
        name: { type: "string", description: "Equipment tag or identifier, e.g. C-1, COND-1" },
        manufacturer: { type: "string", description: "Manufacturer name, e.g. Frick, Mycom, BAC" },
        model: { type: "string", description: "Model number if known" },
        quantity: { type: "number", description: "Number of identical units" },
        hp: { type: "number", description: "Horsepower rating" },
        type: { type: "string", description: "For compressors: screw, reciprocating, rotary. For condensers: evaporative, air_cooled" },
        loop: { type: "string", enum: ["low", "high", "blast"], description: "Which refrigeration loop" },
        suction_setpoint_psig: { type: "number", description: "Suction pressure setpoint in psig" },
        discharge_setpoint_psig: { type: "number", description: "Discharge pressure setpoint in psig" },
        loading_summer: { type: "number", description: "Typical summer loading factor 0-1" },
        loading_shoulder: { type: "number", description: "Typical shoulder season loading 0-1" },
        loading_winter: { type: "number", description: "Typical winter loading factor 0-1" },
        defrost_type: { type: "string", description: "For evaporators: electric, hot_gas, air, none" },
        num_units: { type: "number", description: "For evaporators: number of unit coolers" },
        notes: { type: "string", description: "Any additional notes about this equipment" },
      },
      required: ["category"],
    },
  },
  {
    name: "save_operational_params",
    description: "Save facility operational parameters including system type, refrigerant, hours, and control system info.",
    parameters: {
      type: "object",
      properties: {
        system_type: { type: "string", description: "single_stage, two_stage, or cascade" },
        refrigerant: { type: "string", description: "ammonia, R-22, R-404A, R-507, CO2, R-134a" },
        facility_type: { type: "string", description: "cold_storage, processing, distribution, mixed" },
        operating_days_per_week: { type: "number", description: "Days per week the system operates" },
        daily_hours: { type: "number", description: "Hours per day" },
        runs_24_7: { type: "boolean", description: "Whether facility runs continuously" },
        has_blast_freezing: { type: "boolean", description: "Whether facility has blast freezing capability" },
        has_sub_metering: { type: "boolean", description: "Whether refrigeration has its own electric meter" },
        control_system: { type: "string", description: "Control system brand, e.g. Frick, Logix, GEA Omni" },
        control_hardware: { type: "string", description: "PLC/hardware type, e.g. Opto 22, Allen-Bradley" },
      },
    },
  },
  {
    name: "save_energy_info",
    description: "Save utility and energy rate information.",
    parameters: {
      type: "object",
      properties: {
        supply_provider: { type: "string", description: "Electric supply provider name" },
        distribution_provider: { type: "string", description: "Electric distribution utility name" },
        annual_energy_spend: { type: "number", description: "Approximate annual electricity spend in dollars" },
        approximate_monthly_kwh: { type: "number", description: "Approximate average monthly kWh consumption" },
        peak_demand_kw: { type: "number", description: "Approximate peak demand in kW" },
        rate_name: { type: "string", description: "Utility rate schedule name" },
        account_number: { type: "string", description: "Utility account number" },
        demand_response_status: { type: "string", description: "not_evaluated, enrolled, not_available, or evaluated_not_enrolled" },
      },
    },
  },
  {
    name: "save_operations_detail",
    description: "Save detailed operational information about system behavior and constraints.",
    parameters: {
      type: "object",
      properties: {
        discharge_pressure_typical: { type: "number", description: "Typical discharge pressure in psig" },
        suction_pressure_typical: { type: "number", description: "Typical suction pressure in psig" },
        can_shed_load: { type: "boolean", description: "Can the system shed load for demand response?" },
        can_shutdown: { type: "boolean", description: "Can the system be shut down temporarily?" },
        shutdown_constraints: { type: "string", description: "Constraints on shutting down" },
        curtailment_enrolled: { type: "boolean", description: "Is the facility enrolled in a demand response/curtailment program?" },
        curtailment_frequency: { type: "string", description: "How often curtailment events occur" },
        seasonality_notes: { type: "string", description: "Notes about seasonal load variations" },
        temperature_challenges: { type: "string", description: "Temperature-related operational challenges" },
        operational_nuances: { type: "string", description: "Important operational details or quirks" },
        product_notes: { type: "string", description: "What products are stored, temperature requirements" },
      },
    },
  },
  {
    name: "save_labor_info",
    description: "Save staffing and labor information. Call once per role type, or once for general labor notes.",
    parameters: {
      type: "object",
      properties: {
        role: { type: "string", description: "Job role: refrigeration_engineer, operator, maintenance_tech, contractor, supervisor" },
        count: { type: "number", description: "Number of people in this role" },
        hours_per_week: { type: "number", description: "Typical hours per week per person" },
        hourly_rate: { type: "number", description: "Approximate hourly rate if shared" },
        pain_points: { type: "string", description: "Current pain points and inefficiencies" },
        manual_processes: { type: "string", description: "Manual processes that could be automated" },
        time_sinks: { type: "string", description: "Biggest time wasters" },
        automation_opportunities: { type: "string", description: "Opportunities ATLAS could address" },
      },
    },
  },
  {
    name: "advance_section",
    description: "Move to the next interview section. Call when you've covered all key questions in the current section.",
    parameters: {
      type: "object",
      properties: {
        next_section: {
          type: "string",
          enum: ["facility_overview", "refrigeration_system", "controls", "energy", "operations", "labor", "wrap_up"],
          description: "The section to move to next",
        },
        summary: { type: "string", description: "Brief summary of what was covered in the section we're leaving" },
      },
      required: ["next_section"],
    },
  },
];
