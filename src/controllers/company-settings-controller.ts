import { Request, Response } from "express";
import { dbPool } from "../config/db";
import { v4 as uuidv4 } from "uuid";

const createUpdateCompanySettings = async (req: Request, res: Response) => {
    const {companyName, mailHost, mailPort, mailUser, mailPass} = req.body

    console.log('req.body', req.body);
    

    const client = await dbPool.connect();

    try {
        await client.query("BEGIN")
        const companySettingsDbRes = await client.query("SELECT * FROM company")        

        if(companySettingsDbRes?.rowCount && companySettingsDbRes?.rowCount > 0) {
            const companySettingsData = companySettingsDbRes.rows[0];
            const updatedId = companySettingsData?.id

            await client.query(
                `UPDATE company 
                          SET company_name=$1, smtp_host=$2,
                          smtp_port=$3, smtp_user=$4, smtp_password=$5
                          WHERE id = $6`,
                [companyName, mailHost, Number(mailPort), mailUser, mailPass, updatedId]
              );
        } else {
            console.log('burada');
            
            const newSettingsId = uuidv4();
            await client.query(
                `INSERT INTO company (id, company_name, smtp_host, smtp_port, smtp_user, smtp_password) 
                            VALUES ($1, $2, $3, $4, $5, $6)`,
                [newSettingsId, companyName, mailHost, Number(mailPort), mailUser, mailPass]
            );
        }
        await client.query("COMMIT");
        return res.status(200).json({message: 'Settings saved successfully!'})        
    } catch (error: any) {
        console.error("DB ERROR:", error.message);
        await client.query("ROLLBACK");
        return res.status(500).json({ message: "Internal Server Error" });
    } finally {
        client.release()
    }
}

export { createUpdateCompanySettings }