
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

// The parser runs with processEntities:false (safety), so XML entities
// such as &amp; and &#246; arrive undecoded. Decode them here, once.
function decodeXmlEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&"); // must be last
}

function textValue(value) {
  const text = collectText(value);
  return text ? decodeXmlEntities(text) || null : null;
}

function scopeContentValue(value) {
  const text = collectText(value);

  if (!text) return null;

  // <br/> is stored escaped (&lt;br/&gt;) inside <p>; turn it into a newline
  // BEFORE decoding the remaining entities.
  return (
    decodeXmlEntities(
      text.replace(/&lt;br\s*\/?&gt;/gi, "\n").replace(/\r\n/g, "\n")
    ).trim() || null
  );
}

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDateOnly(value) {
  const text = textValue(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
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
        result.push({
          elementName: key,
          value: item,
        });
      }
    }
  }

  return result;
}

function mapDidNotes(did) {
  return asArray(asObject(did).didnote).map((item) => ({
    localtype: attribute(item, "localtype"),
    text: textValue(item),
  }));
}

class EadMapper {
  map(parsed, errors = [], warnings = []) {
    const ead = child(parsed, "ead");
    const control = child(ead, "control");
    const languageDeclaration = child(
      control,
      "languagedeclaration"
    );
    const fileDescription = child(control, "filedesc");
    const titleStatement = child(fileDescription, "titlestmt");
    const archdesc = child(ead, "archdesc");

    const metadata = {
      recordId: firstText(control.recordid),
      titleProper: firstText(titleStatement.titleproper),
      edition: firstText(
        child(fileDescription, "editionstmt").edition
      ),
      agencyName: firstText(
        child(control, "maintenanceagency").agencyname,
        control.maintenanceagency
      ),
      countryCode: null,
      languageCode: firstText(
        ...asArray(languageDeclaration.language).map((language) =>
          attribute(language, "langcode")
        )
      ),
      scriptCode: firstText(
        ...asArray(languageDeclaration.script).map((script) =>
          attribute(script, "scriptcode")
        )
      ),
      publicationStatus: attribute(control, "audience"),
      eadVersion: attribute(ead, "version") || "EAD3",
    };

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
      warnings,
      metadata.titleProper
    );

    if (!rootNode) {
      errors.push({
        path: "/ead/archdesc",
        message: "The archive description could not be mapped.",
      });
    }

    return {
      metadata,
      rootNode,
    };
  }

  mapNode(
    source,
    elementName,
    path,
    errors,
    warnings,
    fallbackTitle = null
  ) {
    const object = asObject(source);
    const did = child(object, "did");

    const didNotes = mapDidNotes(did);

    const structuralUnitDescription =
      didNotes.find(
        (note) =>
          String(note.localtype || "").toLowerCase() ===
          "structuralunitdescription"
      )?.text ?? null;

    const originalName = firstText(did.unittitle, object.unittitle);

    // ---- <unitid> elements -------------------------------------------
    // One <did> carries several unitid elements:
    //   (no localtype)        the real identifier        -> unitid
    //   localtype="modified"   last-modified timestamp    -> modifiedAt
    //   localtype="modifiedby" last-modified user         -> modifiedBy
    //   localtype="relations"  <ref target="..."> links   -> refs
    let unitid = null;
    let unitidLabel = null;
    let modifiedAt = null;
    let modifiedBy = null;
    const properties = [];
    const refs = [];

    for (const item of asArray(did.unitid)) {
      const localtype = (attribute(item, "localtype") || "").toLowerCase();

      if (localtype === "modified") {
        modifiedAt = parseDateTime(textValue(item));
      } else if (localtype === "modifiedby") {
        modifiedBy = textValue(item);
      } else if (localtype === "relations") {
        for (const ref of asArray(asObject(item).ref)) {
          refs.push({
            targetEadId: attribute(ref, "target"),
            label: textValue(ref),
            linkRole: attribute(ref, "linkrole"),
          });
        }
      } else if (!unitid) {
        unitid = textValue(item);
        unitidLabel = attribute(item, "label");
      } else {
        // an unexpected extra identifier: keep it rather than lose it
        properties.push({
          element: "unitid",
          localtype: localtype || null,
          label: attribute(item, "label"),
          value: textValue(item),
        });
      }
    }

    const fallbackName =
      elementName === "archdesc" ? fallbackTitle : null;

    if (!originalName && !unitid && !fallbackName) {
      errors.push({
        path,
        message: "The node must have a title or unit identifier.",
      });

      return null;
    }

    if (!originalName && fallbackName) {
      warnings.push({
        path,
        message:
          "The archive description has no title; the EAD document title was used as a fallback.",
      });
    } else if (!originalName && unitid) {
      warnings.push({
        path,
        message:
          "The node has no title; its unit identifier will be used.",
      });
    }

    // ---- dates -----------------------------------------------------
    const dateRange = child(child(did, "unitdatestructured"), "daterange");
    const validFrom = isoDateOnly(dateRange.fromdate);
    const validTo = isoDateOnly(dateRange.todate);

    // ---- other did / component content that must not be lost ---------
    for (const physloc of asArray(did.physloc)) {
      const value = textValue(physloc);
      if (value) {
        properties.push({
          element: "physloc",
          localtype: attribute(physloc, "localtype"),
          label: null,
          value,
        });
      }
    }

    // accessrestrict (sekretess) sits in a nested <archdesc> inside <c>
    // in this export, but EAD3 also allows it directly in <c>.
    const accessRestrict =
      [object, child(object, "archdesc")]
        .map((holder) => textValue(holder.accessrestrict))
        .filter(Boolean)
        .join("\n") || null;

    const legalstatus = textValue(object.legalstatus);
    if (legalstatus) {
      properties.push({
        element: "legalstatus",
        localtype: null,
        label: null,
        value: legalstatus,
      });
    }

    for (const relation of asArray(child(object, "relations").relation)) {
      properties.push({
        element: "relation",
        localtype: attribute(relation, "otherrelationtype"),
        label: attribute(relation, "linktitle"),
        value: attribute(relation, "href"),
      });
    }

    const node = {
      nodeType:
        elementName === "archdesc"
          ? "ead_root"
          : "ead_component",
      name: originalName || fallbackName || unitid,
      unitid,
      unitidLabel,
      eadId: attribute(object, "id"),
      level: attribute(object, "level"),
      otherlevel: attribute(object, "otherlevel"),
      structuralUnitDescription,
      didNotes,
      audience: attribute(object, "audience"),
      description: firstText(did.abstract, object.abstract),
      scopeContent: scopeContentValue(object.scopecontent),
      appraisal: textValue(object.appraisal),
      accessRestrict,
      modifiedAt,
      modifiedBy,
      validFrom,
      validTo,
      properties,
      refs,
      children: [],
    };

    // archdesc components are contained in dsc.
    // Nested c/c01-c12 elements are contained in the component itself.
    const componentContainer =
      elementName === "archdesc"
        ? child(object, "dsc")
        : object;

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
