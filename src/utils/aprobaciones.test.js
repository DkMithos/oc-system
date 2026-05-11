// src/utils/aprobaciones.test.js
// Tests unitarios para lógica de aprobaciones y cálculos financieros.
// Mock de Firebase para aislar funciones puras.

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock de Firebase (evita inicialización real) ──────────────────────────────
vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
}));
vi.mock("../firebase/config", () => ({ db: {} }));
vi.mock("./tipoCambio", () => ({
  obtenerTipoCambio: vi.fn(() => Promise.resolve(3.8)),
}));

import {
  ROLES,
  UMBRALES_DEFAULT,
  etapasRequeridas,
  determinarEstadoInicial,
  siguienteEstado,
  puedeAprobarEnEstado,
  isGerenciaRole,
  isBandejaRole,
  isApprovalRole,
  pendingStatesForRole,
  ocPendingForRole,
  TAX_CONFIG,
} from "./aprobaciones";

// ═══════════════════════════════════════════════════════════════════════════════
// ROLES
// ═══════════════════════════════════════════════════════════════════════════════
describe("ROLES", () => {
  it("debe contener todos los roles del sistema", () => {
    expect(ROLES.ADMIN).toBe("admin");
    expect(ROLES.COMPRADOR).toBe("comprador");
    expect(ROLES.OPERACIONES).toBe("operaciones");
    expect(ROLES.GERENCIA_GEN).toBe("gerencia general");
    expect(ROLES.GERENCIA).toBe("gerencia");
    expect(ROLES.FINANZAS).toBe("finanzas");
    expect(ROLES.LEGAL).toBe("legal");
  });

  it("todos los roles deben estar en minúsculas", () => {
    Object.values(ROLES).forEach((rol) => {
      expect(rol).toBe(rol.toLowerCase());
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// etapasRequeridas
// ═══════════════════════════════════════════════════════════════════════════════
describe("etapasRequeridas", () => {
  const config = { ...UMBRALES_DEFAULT, tipoCambioDef: 3.8 };

  it("monto ≤ 5000 SOL: solo Comprador + Operaciones", () => {
    const etapas = etapasRequeridas(5000, "Soles", config);
    expect(etapas).toEqual([
      "Pendiente de Comprador",
      "Pendiente de Operaciones",
    ]);
  });

  it("monto > 5000 SOL: incluye Gerencia General", () => {
    const etapas = etapasRequeridas(5001, "Soles", config);
    expect(etapas).toEqual([
      "Pendiente de Comprador",
      "Pendiente de Operaciones",
      "Pendiente de Gerencia General",
    ]);
  });

  it("monto 0: solo Comprador + Operaciones", () => {
    expect(etapasRequeridas(0, "Soles", config)).toEqual([
      "Pendiente de Comprador",
      "Pendiente de Operaciones",
    ]);
  });

  it("monto negativo: solo Comprador + Operaciones", () => {
    expect(etapasRequeridas(-100, "Soles", config)).toEqual([
      "Pendiente de Comprador",
      "Pendiente de Operaciones",
    ]);
  });

  it("sin config usa UMBRALES_DEFAULT", () => {
    const etapas = etapasRequeridas(10000, "Soles");
    expect(etapas).toContain("Pendiente de Gerencia General");
  });

  // ── Conversión USD → SOL ──────────────────────────────────────────────────
  it("USD bajo umbral: 1000 USD * 3.8 = 3800 ≤ 5000 → sin Gerencia", () => {
    const etapas = etapasRequeridas(1000, "Dólares", config);
    expect(etapas).not.toContain("Pendiente de Gerencia General");
  });

  it("USD sobre umbral: 2000 USD * 3.8 = 7600 > 5000 → con Gerencia", () => {
    const etapas = etapasRequeridas(2000, "Dólares", config);
    expect(etapas).toContain("Pendiente de Gerencia General");
  });

  it("USD exacto en umbral: 5000/3.8 ≈ 1315.79 → no requiere Gerencia", () => {
    const montoExacto = 5000 / 3.8; // ≈ 1315.789
    const etapas = etapasRequeridas(montoExacto, "Dólares", config);
    // 1315.789 * 3.8 = 5000, que es ≤ 5000, no requiere Gerencia
    expect(etapas).not.toContain("Pendiente de Gerencia General");
  });

  it("USD justo por encima del umbral", () => {
    const montoPorEncima = 5000 / 3.8 + 0.01;
    const etapas = etapasRequeridas(montoPorEncima, "Dólares", config);
    expect(etapas).toContain("Pendiente de Gerencia General");
  });

  // ── Umbrales personalizados ───────────────────────────────────────────────
  it("umbral personalizado: 10000 SOL", () => {
    const custom = { soloOperaciones: 10000, tipoCambioDef: 3.8 };
    expect(etapasRequeridas(9999, "Soles", custom)).not.toContain("Pendiente de Gerencia General");
    expect(etapasRequeridas(10001, "Soles", custom)).toContain("Pendiente de Gerencia General");
  });

  it("umbral personalizado con tipo de cambio distinto", () => {
    const custom = { soloOperaciones: 5000, tipoCambioDef: 4.0 };
    // 1250 USD * 4.0 = 5000 ≤ 5000 → sin Gerencia
    expect(etapasRequeridas(1250, "Dólares", custom)).not.toContain("Pendiente de Gerencia General");
    // 1251 USD * 4.0 = 5004 > 5000 → con Gerencia
    expect(etapasRequeridas(1251, "Dólares", custom)).toContain("Pendiente de Gerencia General");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// determinarEstadoInicial
// ═══════════════════════════════════════════════════════════════════════════════
describe("determinarEstadoInicial", () => {
  it("siempre retorna 'Pendiente de Comprador'", () => {
    expect(determinarEstadoInicial()).toBe("Pendiente de Comprador");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// siguienteEstado
// ═══════════════════════════════════════════════════════════════════════════════
describe("siguienteEstado", () => {
  const config = { ...UMBRALES_DEFAULT, tipoCambioDef: 3.8 };

  it("Comprador → Operaciones (monto bajo)", () => {
    expect(siguienteEstado("Pendiente de Comprador", 1000, "Soles", config))
      .toBe("Pendiente de Operaciones");
  });

  it("Operaciones → Aprobada (monto bajo, sin Gerencia)", () => {
    expect(siguienteEstado("Pendiente de Operaciones", 1000, "Soles", config))
      .toBe("Aprobada");
  });

  it("Comprador → Operaciones (monto alto)", () => {
    expect(siguienteEstado("Pendiente de Comprador", 10000, "Soles", config))
      .toBe("Pendiente de Operaciones");
  });

  it("Operaciones → Gerencia General (monto alto)", () => {
    expect(siguienteEstado("Pendiente de Operaciones", 10000, "Soles", config))
      .toBe("Pendiente de Gerencia General");
  });

  it("Gerencia General → Aprobada (monto alto)", () => {
    expect(siguienteEstado("Pendiente de Gerencia General", 10000, "Soles", config))
      .toBe("Aprobada");
  });

  it("estado desconocido → Aprobada", () => {
    expect(siguienteEstado("Estado Inventado", 1000, "Soles", config))
      .toBe("Aprobada");
  });

  it("Aprobada → Aprobada (ya terminó el flujo)", () => {
    expect(siguienteEstado("Aprobada", 1000, "Soles", config))
      .toBe("Aprobada");
  });

  // USD
  it("USD alto: Operaciones → Gerencia General", () => {
    expect(siguienteEstado("Pendiente de Operaciones", 2000, "Dólares", config))
      .toBe("Pendiente de Gerencia General");
  });

  it("USD bajo: Operaciones → Aprobada", () => {
    expect(siguienteEstado("Pendiente de Operaciones", 500, "Dólares", config))
      .toBe("Aprobada");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// puedeAprobarEnEstado
// ═══════════════════════════════════════════════════════════════════════════════
describe("puedeAprobarEnEstado", () => {
  it("comprador puede aprobar en Pendiente de Comprador", () => {
    expect(puedeAprobarEnEstado("Pendiente de Comprador", "comprador")).toBe(true);
  });

  it("comprador NO puede aprobar en Pendiente de Operaciones", () => {
    expect(puedeAprobarEnEstado("Pendiente de Operaciones", "comprador")).toBe(false);
  });

  it("operaciones puede aprobar en Pendiente de Operaciones", () => {
    expect(puedeAprobarEnEstado("Pendiente de Operaciones", "operaciones")).toBe(true);
  });

  it("gerencia general puede aprobar en Pendiente de Gerencia General", () => {
    expect(puedeAprobarEnEstado("Pendiente de Gerencia General", "gerencia general")).toBe(true);
  });

  it("gerencia (alias) puede aprobar en Pendiente de Gerencia General", () => {
    expect(puedeAprobarEnEstado("Pendiente de Gerencia General", "gerencia")).toBe(true);
  });

  it("admin puede aprobar en CUALQUIER estado pendiente", () => {
    expect(puedeAprobarEnEstado("Pendiente de Comprador", "admin")).toBe(true);
    expect(puedeAprobarEnEstado("Pendiente de Operaciones", "admin")).toBe(true);
    expect(puedeAprobarEnEstado("Pendiente de Gerencia General", "admin")).toBe(true);
  });

  it("finanzas NO puede aprobar en ningún estado", () => {
    expect(puedeAprobarEnEstado("Pendiente de Comprador", "finanzas")).toBe(false);
    expect(puedeAprobarEnEstado("Pendiente de Operaciones", "finanzas")).toBe(false);
    expect(puedeAprobarEnEstado("Pendiente de Gerencia General", "finanzas")).toBe(false);
  });

  it("estado Aprobada → nadie puede aprobar", () => {
    expect(puedeAprobarEnEstado("Aprobada", "admin")).toBe(false);
    expect(puedeAprobarEnEstado("Aprobada", "operaciones")).toBe(false);
  });

  it("maneja rol con espacios y mayúsculas", () => {
    expect(puedeAprobarEnEstado("Pendiente de Comprador", "  COMPRADOR  ")).toBe(true);
    expect(puedeAprobarEnEstado("Pendiente de Operaciones", " Operaciones ")).toBe(true);
  });

  it("rol null/undefined → false", () => {
    expect(puedeAprobarEnEstado("Pendiente de Comprador", null)).toBe(false);
    expect(puedeAprobarEnEstado("Pendiente de Comprador", undefined)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers de roles
// ═══════════════════════════════════════════════════════════════════════════════
describe("isGerenciaRole / isBandejaRole / isApprovalRole", () => {
  it("isGerenciaRole reconoce gerencia general, gerencia, gerencia operaciones", () => {
    expect(isGerenciaRole("gerencia general")).toBe(true);
    expect(isGerenciaRole("gerencia")).toBe(true);
    expect(isGerenciaRole("gerencia operaciones")).toBe(true);
    expect(isGerenciaRole("comprador")).toBe(false);
    expect(isGerenciaRole("admin")).toBe(false);
  });

  it("isBandejaRole incluye comprador, operaciones y gerencias", () => {
    expect(isBandejaRole("comprador")).toBe(true);
    expect(isBandejaRole("operaciones")).toBe(true);
    expect(isBandejaRole("gerencia general")).toBe(true);
    expect(isBandejaRole("finanzas")).toBe(false);
  });

  it("isApprovalRole incluye comprador, operaciones y gerencias", () => {
    expect(isApprovalRole("comprador")).toBe(true);
    expect(isApprovalRole("operaciones")).toBe(true);
    expect(isApprovalRole("gerencia general")).toBe(true);
    expect(isApprovalRole("admin")).toBe(false); // admin no está en APPROVAL_ROLES
  });

  it("maneja inputs vacíos/null", () => {
    expect(isGerenciaRole("")).toBe(false);
    expect(isGerenciaRole(null)).toBe(false);
    expect(isBandejaRole(undefined)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// pendingStatesForRole
// ═══════════════════════════════════════════════════════════════════════════════
describe("pendingStatesForRole", () => {
  it("comprador ve Pendiente de Comprador", () => {
    expect(pendingStatesForRole("comprador")).toEqual(["Pendiente de Comprador"]);
  });

  it("operaciones ve Pendiente de Operaciones", () => {
    expect(pendingStatesForRole("operaciones")).toEqual(["Pendiente de Operaciones"]);
  });

  it("gerencia general ve Pendiente de Gerencia General", () => {
    expect(pendingStatesForRole("gerencia general")).toEqual(["Pendiente de Gerencia General"]);
  });

  it("admin ve todos los estados pendientes", () => {
    const estados = pendingStatesForRole("admin");
    expect(estados).toHaveLength(3);
    expect(estados).toContain("Pendiente de Comprador");
    expect(estados).toContain("Pendiente de Operaciones");
    expect(estados).toContain("Pendiente de Gerencia General");
  });

  it("finanzas no tiene estados pendientes", () => {
    expect(pendingStatesForRole("finanzas")).toEqual([]);
  });

  it("rol inexistente devuelve array vacío", () => {
    expect(pendingStatesForRole("inventado")).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ocPendingForRole
// ═══════════════════════════════════════════════════════════════════════════════
describe("ocPendingForRole", () => {
  it("OC pendiente para comprador → true", () => {
    const oc = { estado: "Pendiente de Comprador" };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(true);
  });

  it("OC en otro estado → false para comprador", () => {
    const oc = { estado: "Pendiente de Operaciones" };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(false);
  });

  it("OC asignada a otro usuario → false", () => {
    const oc = { estado: "Pendiente de Comprador", asignadoA: "otro@test.com" };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(false);
  });

  it("OC asignada al mismo usuario → true", () => {
    const oc = { estado: "Pendiente de Comprador", asignadoA: "user@test.com" };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(true);
  });

  it("OC asignada al mismo usuario (case insensitive) → true", () => {
    const oc = { estado: "Pendiente de Comprador", asignadoA: "User@Test.COM" };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(true);
  });

  it("usuario ya firmó → false", () => {
    const oc = {
      estado: "Pendiente de Comprador",
      aprobadores: [{ email: "user@test.com", firmado: true }],
    };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(false);
  });

  it("otro usuario firmó pero yo no → true", () => {
    const oc = {
      estado: "Pendiente de Comprador",
      aprobadores: [
        { email: "otro@test.com", firmado: true },
        { email: "user@test.com", firmado: false },
      ],
    };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(true);
  });

  it("sin aprobadores → true (aún pendiente)", () => {
    const oc = { estado: "Pendiente de Comprador" };
    expect(ocPendingForRole(oc, "comprador", "user@test.com")).toBe(true);
  });

  it("OC vacía → false", () => {
    expect(ocPendingForRole({}, "comprador", "user@test.com")).toBe(false);
  });

  it("rol sin estados → false", () => {
    const oc = { estado: "Pendiente de Comprador" };
    expect(ocPendingForRole(oc, "finanzas", "user@test.com")).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TAX_CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
describe("TAX_CONFIG", () => {
  it("IGV estándar es 18%", () => {
    expect(TAX_CONFIG.IGV_STANDARD).toBe(0.18);
  });

  it("zonas exoneradas tienen 5 departamentos", () => {
    expect(TAX_CONFIG.ZONAS_EXONERADAS).toHaveLength(5);
    expect(TAX_CONFIG.ZONAS_EXONERADAS).toContain("LORETO");
    expect(TAX_CONFIG.ZONAS_EXONERADAS).toContain("AMAZONAS");
    expect(TAX_CONFIG.ZONAS_EXONERADAS).toContain("SAN MARTIN");
    expect(TAX_CONFIG.ZONAS_EXONERADAS).toContain("UCAYALI");
    expect(TAX_CONFIG.ZONAS_EXONERADAS).toContain("MADRE DE DIOS");
  });

  describe("obtenerTasa", () => {
    it("departamento normal → 0.18", () => {
      expect(TAX_CONFIG.obtenerTasa("LIMA")).toBe(0.18);
      expect(TAX_CONFIG.obtenerTasa("AREQUIPA")).toBe(0.18);
      expect(TAX_CONFIG.obtenerTasa("CUSCO")).toBe(0.18);
    });

    it("zona exonerada → 0", () => {
      expect(TAX_CONFIG.obtenerTasa("LORETO")).toBe(0);
      expect(TAX_CONFIG.obtenerTasa("AMAZONAS")).toBe(0);
      expect(TAX_CONFIG.obtenerTasa("UCAYALI")).toBe(0);
      expect(TAX_CONFIG.obtenerTasa("MADRE DE DIOS")).toBe(0);
    });

    it("case insensitive", () => {
      expect(TAX_CONFIG.obtenerTasa("loreto")).toBe(0);
      expect(TAX_CONFIG.obtenerTasa("Loreto")).toBe(0);
      expect(TAX_CONFIG.obtenerTasa("lima")).toBe(0.18);
    });

    it("con espacios extra", () => {
      expect(TAX_CONFIG.obtenerTasa("  LORETO  ")).toBe(0);
      expect(TAX_CONFIG.obtenerTasa(" LIMA ")).toBe(0.18);
    });

    it("vacío → 0.18 (default)", () => {
      expect(TAX_CONFIG.obtenerTasa("")).toBe(0.18);
      expect(TAX_CONFIG.obtenerTasa()).toBe(0.18);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Escenarios de flujo completo (integration-like)
// ═══════════════════════════════════════════════════════════════════════════════
describe("Flujo completo de aprobación", () => {
  const config = { soloOperaciones: 5000, tipoCambioDef: 3.8 };

  it("OC de bajo monto: Comprador → Operaciones → Aprobada", () => {
    const monto = 3000;
    const moneda = "Soles";

    // Estado inicial
    let estado = determinarEstadoInicial();
    expect(estado).toBe("Pendiente de Comprador");
    expect(puedeAprobarEnEstado(estado, "comprador")).toBe(true);

    // Comprador firma
    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Pendiente de Operaciones");
    expect(puedeAprobarEnEstado(estado, "operaciones")).toBe(true);

    // Operaciones firma
    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Aprobada");
  });

  it("OC de alto monto: Comprador → Operaciones → Gerencia → Aprobada", () => {
    const monto = 15000;
    const moneda = "Soles";

    let estado = determinarEstadoInicial();
    expect(estado).toBe("Pendiente de Comprador");

    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Pendiente de Operaciones");

    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Pendiente de Gerencia General");
    expect(puedeAprobarEnEstado(estado, "gerencia general")).toBe(true);

    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Aprobada");
  });

  it("OC en USD alto monto: flujo completo con conversión", () => {
    const monto = 3000; // 3000 * 3.8 = 11400 > 5000
    const moneda = "Dólares";

    let estado = determinarEstadoInicial();
    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Pendiente de Operaciones");

    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Pendiente de Gerencia General");

    estado = siguienteEstado(estado, monto, moneda, config);
    expect(estado).toBe("Aprobada");
  });
});
