-- 0018 · Fechas de la Ficha Técnica según la plantilla del 12/10/2026 (decisión del dueño).
--
-- La Ficha Técnica ya no trae las fechas planeadas ni las reales (inicio y terminación): trae «Fecha Auditoría» y
-- «Fecha Creación del Informe», que el auditor registra antes de generar el informe. La fecha de inicio real (0010)
-- pasa a ser la fecha de la auditoría, con lo ya registrado. La terminación real ya no la pide el formato y se retira
-- (como los campos que retiró la 0009). Las fechas planeadas (fecha_inicio, fecha_fin) siguen en la auditoría.

alter table public.auditorias drop constraint if exists fechas_reales_coherentes;
alter table public.auditorias rename column fecha_inicio_real to fecha_auditoria;
alter table public.auditorias drop column if exists fecha_fin_real;
alter table public.auditorias add column if not exists fecha_informe date;

-- El informe se crea el día de la auditoría o después
alter table public.auditorias
  add constraint fecha_informe_coherente check (fecha_informe is null or fecha_auditoria is null or fecha_informe >= fecha_auditoria);
