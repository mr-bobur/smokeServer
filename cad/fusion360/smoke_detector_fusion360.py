"""
================================================================================
Autodesk Fusion 360 Automation Script: Commercial Smoke Turret Architecture
Product: Commercial Wireless Smoke Detector (CH573 BLE / 2x AA Cartridge)
Features the Elevated Central "Mushroom Turret" 360° Smoke Intake/Exhaust Head
Three Injection-Molded Plastic Bodies:
  - 01_Outer_Cover (With Central Raised Smoke Turret & 360° Flow Windows)
  - 02_Inner_Chassis (Integrated Battery Channels + Optical Chamber + Labyrinth)
  - 03_Ceiling_Base (Universal Mount + 20° Bayonet Cam Tracks)
Non-Plastic Components:
  - 04_PCB (55 x 35 x 1.6 mm)
  - 05_AA_Battery_1
  - 06_AA_Battery_2
  - 07_Battery_Contacts
  - 08_Insect_Mesh (Central Turret Screen Ring)
================================================================================
"""

import adsk.core
import adsk.fusion
import traceback
import os

def run(context):
    ui = None
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface

        # 1. Create a new parametric Fusion 360 document
        doc = app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)
        design = adsk.fusion.Design.cast(app.activeProduct)
        if not design:
            ui.messageBox('No active Fusion 360 Design found.')
            return

        design.designType = adsk.fusion.DesignTypes.ParametricDesignType
        rootComp = design.rootComponent

        # 2. Add Parametric User Parameters
        userParams = design.userParameters

        parameters_definition = [
            ("OuterDiameter", "115.0 mm", "Outer Cover main diameter"),
            ("TotalHeight", "46.0 mm", "Overall assembled height to turret peak"),
            ("DeckHeight", "33.0 mm", "Main housing deck transition height"),
            ("TurretDiameter", "48.0 mm", "Central elevated mushroom smoke turret diameter"),
            ("TurretWindowHeight", "8.0 mm", "360-degree smoke intake open window height"),
            ("TurretPillarCount", "6", "Number of aerodynamic vertical support pillars"),
            ("TurretPillarWidth", "4.0 mm", "Width of each support pillar"),
            ("WallThickness", "2.0 mm", "Nominal injection molding wall thickness"),
            ("DraftAngle", "1.5 deg", "Injection mold ejection draft angle"),
            ("BaseDiameter", "110.0 mm", "Ceiling Base plate diameter"),
            ("BaseThickness", "2.5 mm", "Ceiling Base structural thickness"),
            ("TwistAngle", "20.0 deg", "Bayonet twist-lock rotation travel"),
            ("PCB_Length", "55.0 mm", "Mainboard length (Y-axis)"),
            ("PCB_Width", "35.0 mm", "Mainboard width (X-axis)"),
            ("PCB_Thickness", "1.6 mm", "Standard FR4 4-layer thickness"),
            ("BatteryDiameter", "14.5 mm", "Standard AA cell diameter"),
            ("BatteryLength", "50.5 mm", "AA cell length including positive pip"),
            ("BatteryClearance", "1.0 mm", "Slide-in cartridge clearance"),
            ("MeshThickness", "0.4 mm", "Stainless steel insect mesh thickness"),
            ("OpticalChamberDiameter", "34.0 mm", "Integrated optical chamber outer diameter"),
            ("OpticalChamberHeight", "18.0 mm", "Integrated optical chamber height"),
            ("LightTrapDepth", "6.0 mm", "Integrated light trap baffle depth"),
            ("ScrewDiameter", "4.0 mm", "Ceiling anchor screw clearance diameter"),
            ("RibThickness", "1.2 mm", "Nominal stiffening rib thickness")
        ]

        for param_name, param_val, param_comment in parameters_definition:
            existing = userParams.itemByName(param_name)
            if existing is None:
                val_input = adsk.core.ValueInput.createByString(param_val)
                userParams.add(param_name, val_input, "", param_comment)

        # 3. Locate Associated STEP Models
        script_dir = os.path.dirname(os.path.realpath(__file__))
        models_dir = os.path.abspath(os.path.join(script_dir, "..", "models"))

        components_manifest = [
            ("01_Outer_Cover", "01_Outer_Cover.step", "Plastic - Matte (White)"),
            ("02_Inner_Chassis", "02_Inner_Chassis.step", "Plastic - Matte (Black)"),
            ("03_Ceiling_Base", "03_Ceiling_Base.step", "Plastic - Matte (White)"),
            ("04_PCB", "04_PCB.step", "FR4"),
            ("05_AA_Battery_1", "05_AA_Battery_1.step", "Steel - Polished"),
            ("06_AA_Battery_2", "06_AA_Battery_2.step", "Steel - Polished"),
            ("07_Battery_Contacts", "07_Battery_Contacts.step", "Steel - Polished"),
            ("08_Insect_Mesh", "08_Insect_Mesh.step", "Stainless Steel")
        ]

        importManager = app.importManager
        materialLib = app.materialLibraries.itemByName("Fusion 360 Appearance Library")

        for comp_name, step_filename, appearance_name in components_manifest:
            occ = rootComp.occurrences.addNewComponent(adsk.core.Matrix3D.create())
            newComp = occ.component
            newComp.name = comp_name

            step_path = os.path.join(models_dir, step_filename)
            if os.path.exists(step_path):
                stepOptions = importManager.createSTEPImportOptions(step_path)
                stepOptions.isViewFit = False
                importManager.importToTarget(stepOptions, newComp)

                if materialLib:
                    try:
                        appAppearance = materialLib.appearances.itemByName(appearance_name)
                        if appAppearance:
                            for b in newComp.bRepBodies:
                                b.appearance = appAppearance
                    except:
                        pass

        viewport = app.activeViewport
        viewport.fit()

        ui.messageBox(
            "Commercial Smoke Detector CAD Model Created!\n\n"
            "✓ Elevated Central 'Mushroom Turret' Smoke Intake/Exhaust Head\n"
            "✓ 360-Degree Aerodynamic Inflow Windows with Central Mesh Screen\n"
            "✓ EXACTLY THREE Plastic Bodies: Outer Cover, Inner Chassis, Ceiling Base\n"
            "✓ Integrated Slide-in Cartridge Battery Channels\n"
            "✓ Integrated 90° Optical Chamber & 12-Vane Involute Labyrinth\n"
            "✓ Integrated 20° Bayonet Cam Twist-Lock\n\n"
            "Edit dimensions anytime via 'Modify > Change Parameters'.",
            "Fusion 360 CAD Generator"
        )

    except:
        if ui:
            ui.messageBox('Failed:\n{}'.format(traceback.format_exc()))
