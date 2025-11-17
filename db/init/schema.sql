-- ============================
-- 1. USUARIOS (Entra ID)
-- ============================
CREATE TABLE IF NOT EXISTS usuarios (
    id_msentra_id   VARCHAR(100) PRIMARY KEY,  -- OID de Microsoft Entra ID
    correo          VARCHAR(255) UNIQUE NOT NULL,
    nombre          VARCHAR(255) NOT NULL,
    rol_plataforma  VARCHAR(50) NOT NULL
                    CHECK (rol_plataforma IN ('Estudiante','Docente','Administrador')),
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuarios_rol
    ON usuarios(rol_plataforma);

-- ============================
-- 2. CURSOS Y PARTICIPANTES
-- ============================
CREATE TABLE IF NOT EXISTS cursos (
    id_curso        BIGSERIAL PRIMARY KEY,
    codigo          VARCHAR(50) NOT NULL,          -- ej: FISICAI-2025-1
    nombre          VARCHAR(255) NOT NULL,         -- ej: Física I
    periodo         VARCHAR(50),                   -- ej: 2025-1
    creado_por_id   VARCHAR(100)
                    REFERENCES usuarios(id_msentra_id)
                    ON DELETE SET NULL,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cursos_codigo_periodo
    ON cursos(codigo, periodo);

-- Relación N:M usuario-curso (Estudiante / Docente en un curso específico)
CREATE TABLE IF NOT EXISTS curso_usuarios (
    id_curso        BIGINT NOT NULL
                    REFERENCES cursos(id_curso)
                    ON DELETE CASCADE,
    id_usuario      VARCHAR(100) NOT NULL
                    REFERENCES usuarios(id_msentra_id)
                    ON DELETE CASCADE,
    rol_en_curso    VARCHAR(20) NOT NULL
                    CHECK (rol_en_curso IN ('Estudiante','Docente')),
    fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id_curso, id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_curso_usuarios_usuario
    ON curso_usuarios(id_usuario);

-- ============================
-- 3. PRÁCTICAS
-- ============================
CREATE TABLE IF NOT EXISTS practicas (
    id_practica         BIGSERIAL PRIMARY KEY,
    id_curso            BIGINT NOT NULL
                        REFERENCES cursos(id_curso)
                        ON DELETE CASCADE,
    titulo              VARCHAR(200) NOT NULL,
    descripcion         TEXT,
    estado              VARCHAR(30) NOT NULL
                        CHECK (estado IN ('borrador','activa','cerrada')),
    fecha_publicacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fecha_cierre        TIMESTAMPTZ,
    creado_por_id       VARCHAR(100)
                        REFERENCES usuarios(id_msentra_id)
                        ON DELETE SET NULL,
    configuracion_simulacion JSONB,   -- parámetros base de Unity/WebGL
    rubrica_id          BIGINT        -- FK a rubricas (se crea más abajo)
);

CREATE INDEX IF NOT EXISTS idx_practicas_curso
    ON practicas(id_curso);

CREATE INDEX IF NOT EXISTS idx_practicas_estado
    ON practicas(estado);

-- ============================
-- 4. RÚBRICAS DE EVALUACIÓN
-- ============================
CREATE TABLE IF NOT EXISTS rubricas (
    id_rubrica      BIGSERIAL PRIMARY KEY,
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    creado_por_id   VARCHAR(100)
                    REFERENCES usuarios(id_msentra_id)
                    ON DELETE SET NULL,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rubrica_criterios (
    id_criterio     BIGSERIAL PRIMARY KEY,
    id_rubrica      BIGINT NOT NULL
                    REFERENCES rubricas(id_rubrica)
                    ON DELETE CASCADE,
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    peso            NUMERIC(5,2) NOT NULL, -- ej: 30.0 = 30%
    posicion        INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_rubrica_criterios_rubrica
    ON rubrica_criterios(id_rubrica);

-- Vincular práctica con rúbrica (1:N)
ALTER TABLE practicas
    ADD CONSTRAINT IF NOT EXISTS fk_practicas_rubrica
    FOREIGN KEY (rubrica_id) REFERENCES rubricas(id_rubrica)
    ON DELETE SET NULL;

-- ============================
-- 5. SIMULACIONES (EJECUCIONES)
-- ============================
CREATE TABLE IF NOT EXISTS simulaciones (
    id_simulacion   BIGSERIAL PRIMARY KEY,
    id_practica     BIGINT NOT NULL
                    REFERENCES practicas(id_practica)
                    ON DELETE CASCADE,
    id_usuario      VARCHAR(100) NOT NULL
                    REFERENCES usuarios(id_msentra_id)
                    ON DELETE CASCADE,
    intento         INT NOT NULL DEFAULT 1,  -- 1er intento, 2do, etc.
    parametros      JSONB,        -- parámetros ingresados por el estudiante
    resultado       JSONB,        -- datos de salida / mediciones
    fecha_ejecucion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_simulaciones_practica_usuario
    ON simulaciones(id_practica, id_usuario);

-- ============================
-- 6. INFORMES
-- ============================
CREATE TABLE IF NOT EXISTS informes (
    id_informe      BIGSERIAL PRIMARY KEY,
    id_practica     BIGINT NOT NULL
                    REFERENCES practicas(id_practica)
                    ON DELETE CASCADE,
    id_usuario      VARCHAR(100) NOT NULL
                    REFERENCES usuarios(id_msentra_id)
                    ON DELETE CASCADE,
    id_simulacion   BIGINT
                    REFERENCES simulaciones(id_simulacion)
                    ON DELETE SET NULL,
    titulo          VARCHAR(200),
    archivo_url     TEXT,         -- ruta a archivo (Azure)
    contenido_texto TEXT,
    estado          VARCHAR(30) NOT NULL DEFAULT 'entregado'
                    CHECK (estado IN ('borrador','entregado','calificado')),
    fecha_entrega   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nota            NUMERIC(5,2),
    retroalimentacion TEXT
);

CREATE INDEX IF NOT EXISTS idx_informes_practica_usuario
    ON informes(id_practica, id_usuario);

-- ============================
-- 7. CALIFICACIÓN POR RÚBRICA
-- ============================
CREATE TABLE IF NOT EXISTS rubrica_calificaciones (
    id_calificacion BIGSERIAL PRIMARY KEY,
    id_informe      BIGINT NOT NULL
                    REFERENCES informes(id_informe)
                    ON DELETE CASCADE,
    id_criterio     BIGINT NOT NULL
                    REFERENCES rubrica_criterios(id_criterio)
                    ON DELETE CASCADE,
    calificacion    NUMERIC(5,2) NOT NULL,
    comentario      TEXT
);

CREATE INDEX IF NOT EXISTS idx_rubrica_calificaciones_informe
    ON rubrica_calificaciones(id_informe);

-- ============================
-- 8. FOROS Y COMENTARIOS
-- ============================
CREATE TABLE IF NOT EXISTS foros (
    id_foro         BIGSERIAL PRIMARY KEY,
    id_practica     BIGINT NOT NULL UNIQUE
                    REFERENCES practicas(id_practica)
                    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comentarios_foro (
    id_comentario       BIGSERIAL PRIMARY KEY,
    id_foro             BIGINT NOT NULL
                        REFERENCES foros(id_foro)
                        ON DELETE CASCADE,
    id_usuario          VARCHAR(100) NOT NULL
                        REFERENCES usuarios(id_msentra_id)
                        ON DELETE CASCADE,
    id_comentario_padre BIGINT
                        REFERENCES comentarios_foro(id_comentario)
                        ON DELETE CASCADE,
    contenido           TEXT NOT NULL,
    fecha_creacion      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comentarios_foro_foro
    ON comentarios_foro(id_foro);

-- ============================
-- 9. ASISTENCIA / FALLAS
-- ============================
CREATE TABLE IF NOT EXISTS asistencia_practica (
    id_asistencia   BIGSERIAL PRIMARY KEY,
    id_practica     BIGINT NOT NULL
                    REFERENCES practicas(id_practica)
                    ON DELETE CASCADE,
    id_usuario      VARCHAR(100) NOT NULL
                    REFERENCES usuarios(id_msentra_id)
                    ON DELETE CASCADE,
    estado          VARCHAR(20) NOT NULL
                    CHECK (estado IN ('asistio','falta','justificada')),
    observaciones   TEXT,
    fecha_registro  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (id_practica, id_usuario)
);

-- ============================
-- 10. NOTIFICACIONES
-- ============================
CREATE TABLE IF NOT EXISTS notificaciones (
    id_notificacion BIGSERIAL PRIMARY KEY,
    id_usuario      VARCHAR(100) NOT NULL
                    REFERENCES usuarios(id_msentra_id)
                    ON DELETE CASCADE,
    tipo            VARCHAR(50) NOT NULL, -- ej: 'nueva_retro', 'nueva_practica'
    titulo          VARCHAR(200),
    mensaje         TEXT,
    data            JSONB,               -- info adicional: { "id_practica": 1, ... }
    leida           BOOLEAN NOT NULL DEFAULT FALSE,
    fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_leida
    ON notificaciones(id_usuario, leida);


DO $$
BEGIN
    -- Verificar si la constraint ya existe
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_practicas_rubrica'
          AND table_name = 'practicas'
    ) THEN
    
        ALTER TABLE practicas
        ADD CONSTRAINT fk_practicas_rubrica
        FOREIGN KEY (rubrica_id)
        REFERENCES rubricas(id_rubrica)
        ON DELETE SET NULL;

    END IF;
END
$$;
