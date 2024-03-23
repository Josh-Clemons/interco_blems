CREATE TABLE "blems" (
                         "id" SERIAL PRIMARY KEY,
                         "sku" VARCHAR (20) UNIQUE NOT NULL,
                         "brand" VARCHAR (40),
                         "size" VARCHAR (20),
                         "quantity" VARCHAR(3),
                         "price" VARCHAR(10),
                         "discontinued" BOOL default false,
                         "new" BOOL default true,
                         "notify" BOOL default true,
                         "created_at" TIMESTAMP default NOW(),
                         "updated_at" TIMESTAMP default NOW()
);

CREATE TABLE blems_history AS TABLE blems WITH NO DATA;

CREATE OR REPLACE FUNCTION save_history() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO blems_history SELECT NEW.*;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER saveHistory
    AFTER UPDATE ON blems
    FOR EACH ROW EXECUTE PROCEDURE save_history();