# Modelo de Sinergia y Margen de Riesgo

> **Cotizador Eléctrico PWA - IEBA**  
> *Este documento ha sido reemplazado por la especificación simplificada:*  
> 👉 Consulte **[`MODELO_SINERGIA_Y_RIESGO.md`](MODELO_SINERGIA_Y_RIESGO.md)** para la documentación vigente.

---

### Resumen de la Decisión de Producto
La aplicación **cotiza, no planifica obra**. Se eliminó la maquinaria estocástica fina ($\sigma_i, Z_p$) y los regímenes horarios laborales, consolidando el cálculo en:
1. **Sinergia Determinística ($\mu_{\text{sinérgico}}$):** Ahorro de setup compartido + Bono tándem con operarios como entrada manual.
2. **Margen de Riesgo Global (`margen_riesgo`):** Colchón porcentual explícito y configurable (+10%, +20%, +35% o personalizado) aplicado sobre el costo directo.
