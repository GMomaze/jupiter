// src/modules/assets/asset.controller.ts

export const postInstallComponent = async (req: Request, res: Response) => {
    try {
        const { aircraft_id, model_id, serial_number, tsn_at_install, tso_at_install } = req.body;

        const component = await AssetService.installComponent({
            aircraftId: aircraft_id,
            modelId: model_id,
            serialNumber: serial_number,
            tsnAtInstall: parseFloat(tsn_at_install),
            tsoAtInstall: parseFloat(tso_at_install)
        });

        // Return a partial to update the component list or a success toast
        res.setHeader('HX-Trigger', 'componentInstalled');
        return res.send(`
            <div class="alert alert-success">
                Component ${serial_number} successfully registered and installed.
            </div>
        `);
    } catch (error: any) {
        res.status(400).send(`<div class="alert alert-danger">${error.message}</div>`);
    }
};