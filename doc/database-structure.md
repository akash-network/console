## Database Structure

Our project uses a dual ORM approach for database management:

1. **Sequelize-TypeScript**: 
   - Used for defining the primary database schema.
   - Schema definitions are located in [/shared/dbSchemas/](../packages/database/dbSchemas/).
   - Models are organized into the following folders:
     - **base**: Tables which are Cosmos generic and used for every chain
     - **akash**: Tables which are Akash-specific
     - **user**: Tables which are user-specific, containing tables for user settings and templates

2. **Drizzle ORM**:
   - Utilized in the API for database operations.
   - Configuration can be found in `drizzle.config.ts` in the API directory.

The use of both ORMs allows us to leverage the strengths of each:
- Sequelize-TypeScript provides robust schema definition and migration capabilities.
- Drizzle ORM offers type-safe queries and improved performance for API operations.

For more details on the Drizzle ORM setup and usage, refer to the `drizzle.config.ts` file in the API directory.

Note: We're planning on migrating all the models to drizzle eventually, so when you want to add new tables please add them using drizzle.