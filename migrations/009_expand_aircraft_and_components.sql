-- Expansion of Aircraft Table
ALTER TABLE aircraft 
ADD COLUMN serial_number VARCHAR(255) UNIQUE,
ADD COLUMN total_hours DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN total_cycles INTEGER DEFAULT 0;

-- Component Models (The Library)
CREATE TABLE component_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer_id UUID REFERENCES rf_manufacturers(id),
    model_name VARCHAR(255) NOT NULL,
    category_id UUID REFERENCES rf_component_categories(id),
    tbo_hours DECIMAL(10, 2),
    calendar_limit_months INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Physical Component Instances (The Fleet)
CREATE TABLE aircraft_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
    component_model_id UUID REFERENCES component_models(id),
    serial_number VARCHAR(255) NOT NULL,
    installation_date DATE NOT NULL,
    install_hours_airframe DECIMAL(10, 2) NOT NULL,
    tso_at_install DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    tsn_at_install DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prevent duplicate active components of same model on one aircraft (e.g., two engines on a single-engine plane)
CREATE UNIQUE INDEX idx_unique_active_component 
ON aircraft_components (aircraft_id, component_model_id) 
WHERE is_active = TRUE;