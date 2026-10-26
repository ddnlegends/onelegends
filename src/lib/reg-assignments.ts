/** Confirmed chair emails and the 21 Partner Competition names in the assignment sheet. */
export const INITIAL_REG_ASSIGNMENTS = [
  { name: "UGA India Night", email: "ishan.swamy@desidancenetwork.org", contactName: "Ishan Swamy" },
  { name: "Maryland Minza", email: "rithika.shenoy@desidancenetwork.org", contactName: "Rithika Shenoy" },
  { name: "Buckeye Mela", email: "ishan.swamy@desidancenetwork.org", contactName: "Ishan Swamy" },
  { name: "Udaan", email: "prateesh.vijayakumar@desidancenetwork.org", contactName: "Prateesh Vijayakumar" },
  { name: "Norman Nachle", email: "rithika.shenoy@desidancenetwork.org", contactName: "Rithika Shenoy" },
  { name: "Blacksburg Ki Badmaashi", email: "ishan.swamy@desidancenetwork.org", contactName: "Ishan Swamy" },
  { name: "Naach Di Cleveland", email: "ishan.swamy@desidancenetwork.org", contactName: "Ishan Swamy" },
  { name: "ADZ", aliases: ["Aa Dekhen Zara"], email: "chinmayi.mohite@desidancenetwork.org", contactName: "Chinmayi Mohite" },
  { name: "Infusion", email: "prateesh.vijayakumar@desidancenetwork.org", contactName: "Prateesh Vijayakumar" },
  { name: "Jhalak", email: "prateesh.vijayakumar@desidancenetwork.org", contactName: "Prateesh Vijayakumar" },
  { name: "Motor City Dhamaal", email: "chinmayi.mohite@desidancenetwork.org", contactName: "Chinmayi Mohite" },
  { name: "NJ Naach", email: "rithika.shenoy@desidancenetwork.org", contactName: "Rithika Shenoy" },
  { name: "Jazba", email: "chinmayi.mohite@desidancenetwork.org", contactName: "Chinmayi Mohite" },
  { name: "Bloomington Ki Badtameezi", email: "prateesh.vijayakumar@desidancenetwork.org", contactName: "Prateesh Vijayakumar" },
  { name: "AKD", aliases: ["Aaj Ka Dhamaka"], email: "ishan.swamy@desidancenetwork.org", contactName: "Ishan Swamy" },
  { name: "TamashaSD", email: "rithika.shenoy@desidancenetwork.org", contactName: "Rithika Shenoy" },
  { name: "Chak De C'ville", email: "chinmayi.mohite@desidancenetwork.org", contactName: "Chinmayi Mohite" },
  { name: "Nachte Raho", email: "prateesh.vijayakumar@desidancenetwork.org", contactName: "Prateesh Vijayakumar" },
  { name: "Aag Ki Raat", email: "chinmayi.mohite@desidancenetwork.org", contactName: "Chinmayi Mohite" },
  { name: "Aaja Nachle", email: "rithika.shenoy@desidancenetwork.org", contactName: "Rithika Shenoy" },
  { name: "Tufaan", email: "ishan.swamy@desidancenetwork.org", contactName: "Ishan Swamy" },
] as const;

export function normalizeRegCompName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveInitialRegAssignments(
  competitions: { id: string; name: string; isPartner: boolean }[],
) {
  const matches: { competitionId: string; competitionName: string; email: string; contactName: string }[] = [];
  const issues: string[] = [];
  for (const assignment of INITIAL_REG_ASSIGNMENTS) {
    const names = [assignment.name, ...("aliases" in assignment ? assignment.aliases : [])]
      .map(normalizeRegCompName);
    const candidates = competitions.filter((competition) => names.includes(normalizeRegCompName(competition.name)));
    if (candidates.length !== 1) {
      issues.push(`${assignment.name}: expected one competition record; found ${candidates.length}.`);
      continue;
    }
    const competition = candidates[0];
    if (!competition.isPartner) {
      issues.push(`${assignment.name}: ${competition.name} is marked Non-partner.`);
      continue;
    }
    matches.push({
      competitionId: competition.id,
      competitionName: competition.name,
      email: assignment.email,
      contactName: assignment.contactName,
    });
  }
  if (new Set(matches.map((match) => match.competitionId)).size !== matches.length) {
    issues.push("Two screenshot rows matched the same competition record.");
  }
  return { matches, issues };
}
