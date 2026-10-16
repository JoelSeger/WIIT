function asObject(value) {
  if (Array.isArray(value)) {
    return asObject(value[0]);
  }

  if (value && typeof value === "object") {
    return value;
  }

  return {};
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function child(object, key) {
  return asObject(asObject(object)[key]);
}

function collectText(value) {
  if (value == null) return "";

  if (typeof value === "string" || typeof value === "number") {
    return String(value).trim();
  }

  if (Array.isArray(value)) {
    return value.map(collectText).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "#text")) {
      return collectText(value["#text"]);
    }

    return Object.entries(value)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, item]) => collectText(item))
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function textValue(value) {
  return collectText(value) || null;
}

function attribute(object, name) {
  return textValue(asObject(object)[`@_${name}`]);
}

function firstText(...values) {
  for (const value of values) {
    const text = textValue(value);
    if (text) return text;
  }

  return null;
}

function componentEntries(source) {
  const result = [];

  for (const [key, value] of Object.entries(asObject(source))) {
    if (/^c(?:0[1-9]|1[0-2])?$/.test(key)) {
      for (const item of asArray(value)) {
        result.push({ elementName: key, value: item });
      }
    }
  }

  return result;
}

class EadMapper {
  map(parsed, errors = [], warnings = []) {
    const ead = child(parsed, "ead");
    const control = child(ead, "control");
    const filedesc = child(control, "filedesc");
    const titlestmt = child(filedesc, "titlestmt");
    const archdesc = child(ead, "archdesc");

    const did = child(archdesc, "did");

    const metadata = {
      recordId: firstText(control.recordid),
      titleProper: firstText(titlestmt.titleproper),
      edition: firstText(titlestmt.editionstmt),
      agencyName: firstText(
        control.maintenanceagency?.agencyname,
        control.maintenanceagency
      ),
      countryCode: attribute(control, "countryencoding") || "SE",
      languageCode: attribute(control, "langencoding"),
      scriptCode: null,
      publicationStatus: attribute(control, "audience"),
      eadVersion: attribute(ead, "version") || "EAD3",
    };

    // This is a best-effort mapping. EAD control attributes
    // do not always represent the language of the document.
    if (!metadata.titleProper) {
      errors.push({
        path: "/ead/control/filedesc/titlestmt/titleproper",
        message: "The EAD document title is missing.",
      });
    }

    const rootNode = this.mapNode(
      archdesc,
      "archdesc",
      "/ead/archdesc",
      errors,
      warnings
    );

    if (!rootNode) {
      errors.push({
        path: "/ead/archdesc",
        message: "The archive description could not be mapped.",
      });
    }

    return { metadata, rootNode };
  }

  mapNode(source, elementName, path, errors, warnings) {
    const object = asObject(source);
    const did = child(object, "did");

    const name = firstText(did.unittitle, object.unittitle);
    const unitid = firstText(did.unitid, object.unitid);

    if (!name && !unitid) {
      errors.push({
        path,
        message: "The node must have a title or unit identifier.",
      });

      return null;
    }

    if (!name && unitid) {
      warnings.push({
        path,
        message: "The node has no title; its unit identifier will be used.",
      });
    }

    const node = {
      nodeType: elementName === "archdesc" ? "ead_root" : "ead_component",
      name: name || unitid,
      unitid,
      eadId: attribute(object, "id"),
      level: attribute(object, "level"),
      otherlevel: attribute(object, "otherlevel"),
      audience: attribute(object, "audience"),
      description: firstText(did.abstract, object.abstract),
      scopeContent: textValue(object.scopecontent),
      appraisal: textValue(object.appraisal),
      children: [],
    };

    const componentContainer =
      elementName === "archdesc" ? child(object, "dsc") : object;

    for (const entry of componentEntries(componentContainer)) {
      const childNode = this.mapNode(
        entry.value,
        entry.elementName,
        `${path}/${entry.elementName}`,
        errors,
        warnings
      );

      if (childNode) {
        node.children.push(childNode);
      }
    }

    return node;
  }
}

module.exports = { EadMapper };